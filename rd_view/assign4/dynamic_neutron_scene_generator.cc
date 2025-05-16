#define _USE_MATH_DEFINES
#include <iostream>
#include <cmath>
#include <vector>
#include <random>
#include <cstdlib>
#include <string>
#include <deque>

/**
 * @brief Random number generator helper for stochastic simulation components
 */
struct RandomGenerator {
    std::random_device rd;               // Hardware random number source for seeding
    std::mt19937 gen;                    // Mersenne Twister PRNG engine
    std::uniform_real_distribution<float> uniform_dist;  // Uniform distribution [0,1]

    /**
     * @brief Constructor initializes the random number generator with hardware-based seed
     */
    RandomGenerator() : gen(rd()), uniform_dist(0.0f, 1.0f) {}

    /**
     * @brief Generate random float in range [0,1]
     * @return Float value between 0 and 1 inclusive
     */
    float getFloat() {
        return uniform_dist(gen);
    }

    /**
     * @brief Generate random float in specified range [min,max]
     * @param min Lower bound of range
     * @param max Upper bound of range
     * @return Float value between min and max inclusive
     */
    float getFloat(float min, float max) {
        return min + (max - min) * uniform_dist(gen);
    }

    /**
     * @brief Generate random unit direction vector using spherical coordinates
     * 
     * This method creates a random direction vector uniformly distributed on a unit sphere
     * by sampling spherical coordinates and converting to Cartesian coordinates.
     * 
     * @param dir Output parameter - 3D array to store the generated direction
     */
    void randomDirection(float* dir) {
        float phi = uniform_dist(gen) * 2.0f * M_PI;
        float costheta = 2.0f * uniform_dist(gen) - 1.0f;
        float sintheta = std::sqrt(1.0f - costheta * costheta);

        dir[0] = sintheta * std::cos(phi);
        dir[1] = sintheta * std::sin(phi);
        dir[2] = costheta;
    }
};

/**
 * @brief Core simulation parameters controlling neutron behavior
 * 
 * These parameters define the physical characteristics of the simulation and can be
 * adjusted via command line arguments (num_neutrons, num_frames) or modified directly
 * in the source code for different simulation behaviors.
 */
int num_neutrons = 250;      // Default number of neutrons (Minimum 200 recommended)
float max_lifetime = 100.0f; // Maximum neutron lifetime before removal
float absorption_probability = 0.1f; // Probability of neutron being absorbed
float fission_probability = 0.15f;   // Probability of neutron causing fission
float mean_free_path = 2.0f;  // Average distance between neutron interactions
float source_radius = 0.5f;   // Radius of the neutron source sphere
float max_distance = 10.0f;   // Maximum distance from origin before neutron is removed
float timestep = 0.5f;        // Size of simulation time step
int num_frames = 50;          // Default number of animation frames to generate

/**
 * @brief Energy group definitions for multi-group neutron physics
 */
const int NUM_ENERGY_GROUPS = 3;  // Number of discrete energy groups

/**
 * @brief Energy levels for each neutron group in arbitrary units
 * 
 * Higher values represent faster neutrons with more kinetic energy
 * - Group 0: Fast neutrons (newly born from fission)
 * - Group 1: Epithermal neutrons (partially moderated)
 * - Group 2: Thermal neutrons (fully moderated)
 */
const float GROUP_ENERGIES[NUM_ENERGY_GROUPS] = {10.0f, 5.0f, 1.0f};

/**
 * @brief Color mappings for visualizing neutrons by energy group
 * 
 * These RGB color values provide visual distinction between neutron energy groups:
 * - Fast neutrons: Red
 * - Epithermal neutrons: Yellow
 * - Thermal neutrons: Blue
 */
const float GROUP_COLORS[NUM_ENERGY_GROUPS][3] = {
    {1.0f, 0.2f, 0.0f},  // Fast neutrons (red)
    {1.0f, 0.8f, 0.0f},  // Epithermal neutrons (yellow)
    {0.0f, 0.5f, 1.0f}   // Thermal neutrons (blue)
};

/**
 * @brief Scattering transition probability matrix between energy groups
 * 
 * This matrix defines the probability that a neutron in group i will transition
 * to group j during a scattering event. The matrix models the physics of neutron
 * moderation, where neutrons generally lose energy but rarely gain energy.
 */
const float SCATTERING_PROBABILITIES[NUM_ENERGY_GROUPS][NUM_ENERGY_GROUPS] = {
    {0.5f, 0.4f, 0.1f},   // Fast neutron scattering probabilities
    {0.0f, 0.6f, 0.4f},   // Epithermal neutron scattering probabilities
    {0.0f, 0.0f, 1.0f}    // Thermal neutron scattering probabilities
};

/**
 * @brief Structure to track fission events for visualization
 * 
 * This structure records the position and time of neutron fission events
 * to create visual indicators (expanding spheres) in the rendered scene.
 */
struct FissionEvent {
    float position[3];  // 3D position where the fission event occurred
    float time;         // Simulation time when the fission event occurred
    
    /**
     * @brief Construct a fission event
     * 
     * @param pos Pointer to 3D array containing position
     * @param t Time of the fission event
     */
    FissionEvent(const float* pos, float t) : time(t) {
        position[0] = pos[0];
        position[1] = pos[1];
        position[2] = pos[2];
    }
};

/**
 * @brief Class to represent a simulated neutron particle
 * 
 * This class models individual neutrons with their position, velocity, energy level,
 * and lifetime. It handles neutron initialization, movement, interactions (scattering,
 * absorption, fission), and applies stochastic modeling to determine outcomes
 */
class Neutron {
public:
    float position[3];  // Current 3D position
    float velocity[3];  // Direction unit vector
    int energy_group;   // Current energy group (0=fast, 1=epithermal, 2=thermal)
    float lifetime;     // Time since creation in simulation time units
    bool active;        // Whether neutron is currently active in the simulation
    
    /**
     * @brief Default constructor initializes an inactive neutron at the origin
     */
    Neutron() : energy_group(0), lifetime(0.0f), active(false) {
        position[0] = position[1] = position[2] = 0.0f;
        velocity[0] = velocity[1] = velocity[2] = 0.0f;
    }
    
    /**
     * @brief Initialize a neutron at the source with random position and direction
     * 
     * @param random_gen Reference to random generator for stochastic sampling
     */
    void init(RandomGenerator& random_gen) {
        float phi = random_gen.getFloat() * 2.0f * M_PI;
        float costheta = 2.0f * random_gen.getFloat() - 1.0f;
        float sintheta = std::sqrt(1.0f - costheta * costheta);
        float r = source_radius * std::pow(random_gen.getFloat(), 1.0f / 3.0f);

        position[0] = r * sintheta * std::cos(phi);
        position[1] = r * sintheta * std::sin(phi);
        position[2] = r * costheta;

        random_gen.randomDirection(velocity);

        energy_group = 0;
        lifetime = 0.0f;
        active = true;
    }
    
    /**
     * @brief Create a neutron from a fission event at a specific position
     * 
     * This is called when fission occurs and new neutrons are created.
     * The position is inherited from the fission location, with random direction.
     * 
     * @param pos Pointer to position array where fission occurred
     * @param random_gen Reference to random generator for direction sampling
     */
    void initFromFission(const float* pos, RandomGenerator& random_gen) {
        position[0] = pos[0];
        position[1] = pos[1];
        position[2] = pos[2];

        random_gen.randomDirection(velocity);

        energy_group = 0;
        lifetime = 0.0f;
        active = true;
    }
    
    /**
     * @brief Update neutron state for one simulation time step
     * 
     * This core method handles:
     * 1. Lifetime tracking and maximum lifetime check
     * 2. Stochastic interaction sampling (scattering, absorption, fission)
     * 3. Position updates based on energy-dependent speed
     * 4. Boundary checking (removes neutrons that leave the simulation area)
     * 5. Spawning of new neutrons upon fission
     * 
     * The interaction probability is calculated using an exponential distribution
     * based on the mean free path, which varies with neutron energy.
     * 
     * @param dt Time step size
     * @param neutrons Vector of all neutrons in the simulation (for spawning new neutrons)
     * @param fission_events Collection of fission events for visualization
     * @param simulation_time Current global simulation time
     * @param random_gen Reference to random generator
     */
    void update(float dt, std::vector<Neutron>& neutrons, std::deque<FissionEvent>& fission_events, 
                float simulation_time, RandomGenerator& random_gen) {
        if (!active) return;

        lifetime += dt;

        if (lifetime > max_lifetime) {
            active = false;
            return;
        }

        float mean_free_path_energy = mean_free_path * (1.0f + GROUP_ENERGIES[energy_group] * 0.1f);
        float interaction_prob = 1.0f - std::exp(-dt / mean_free_path_energy);

        if (random_gen.getFloat() < interaction_prob) {
            float r = random_gen.getFloat();
            
            if (r < 1.0f - absorption_probability - fission_probability) {
                random_gen.randomDirection(velocity);
                
                float scatter_r = random_gen.getFloat();
                float cumulative_prob = 0.0f;
                
                for (int target_group = 0; target_group < NUM_ENERGY_GROUPS; target_group++) {
                    cumulative_prob += SCATTERING_PROBABILITIES[energy_group][target_group];
                    if (scatter_r < cumulative_prob) {
                        energy_group = target_group;
                        break;
                    }
                }
            } 
            else if (r < 1.0f - fission_probability) {
                active = false;
                return;
            } 
            else {
                active = false;

                int new_neutrons = 2;
                if (random_gen.getFloat() < 0.5f) new_neutrons = 3;

                fission_events.push_back(FissionEvent(position, simulation_time));
                if (fission_events.size() > 20) {
                    fission_events.pop_front();
                }

                int count = 0;
                for (auto& n : neutrons) {
                    if (!n.active) {
                        n.initFromFission(position, random_gen);
                        count++;
                        if (count >= new_neutrons) break;
                    }
                }
                return;
            }
        }

        float speed = std::sqrt(GROUP_ENERGIES[energy_group]) * 2.0f;
        position[0] += velocity[0] * speed * dt;
        position[1] += velocity[1] * speed * dt;
        position[2] += velocity[2] * speed * dt;

        float dist = std::sqrt(position[0] * position[0] +
                               position[1] * position[1] +
                               position[2] * position[2]);
        if (dist > max_distance) {
            active = false;
        }
    }
};

/**
 * @brief Core simulation class managing the neutron physics and visualization
 */
class NeutronSimulation {
private:
    std::vector<Neutron> neutrons;        // Collection of all neutrons in the simulation
    std::deque<FissionEvent> fission_events; // Record of recent fission events for visualization
    float simulation_time;                // Current global simulation time
    RandomGenerator random_gen;           // Random number generator for stochastic processes
    
public:
    /**
     * @brief Constructor initializes the neutron simulation with default parameters
     */
    NeutronSimulation() : simulation_time(0.0f) {
        neutrons.resize(num_neutrons);
        
        int initial_count = num_neutrons / 3;
        for (int i = 0; i < initial_count; i++) {
            neutrons[i].init(random_gen);
        }
    }
    
    /**
     * @brief Advances the simulation by one time step
     * 
     * This method:
     * 1. Increments the simulation time
     * 2. Periodically spawns new neutrons from the source
     * 3. Updates the state of all active neutrons (movement, interactions, etc.)
     */
    void update() {
        simulation_time += timestep;
        
        if (fmod(simulation_time, 10.0f) < timestep) {
            int spawn_count = num_neutrons / 10;
            int activated = 0;
            
            for (auto& n : neutrons) {
                if (!n.active) {
                    n.init(random_gen);
                    activated++;
                    if (activated >= spawn_count) break;
                }
            }
        }
        
        for (auto& neutron : neutrons) {
            neutron.update(timestep, neutrons, fission_events, simulation_time, random_gen);
        }
    }
    
    /**
     * @brief Generates RD scene description for the current simulation state
     * 
     * Creates a complete scene description in RD format for the current frame,
     * including camera setup (only on the first frame), lighting, environment,
     * neutrons (colored by energy group), fission events, and direction indicators.
     * 
     * @param frame_num The current frame number (starts at 1)
     * @param output_format Output format, either "Screen" for direct display or "PNM" for image files
     */
    void generateFrame(int frame_num, const std::string& output_format = "Screen") {
        std::cout << "# Neutron Diffusion Simulation - Frame " << frame_num << std::endl;
        
        if (frame_num == 1) {
            if (output_format == "PNM") {
                std::cout << "Display \"NeutronDiffusion\" \"PNM\" \"rgb\"" << std::endl;
            } else {
                std::cout << "Display \"Neutron Diffusion\" \"Screen\" \"rgbdouble\"" << std::endl;
            }
            std::cout << "Format 800 600" << std::endl;
            std::cout << "CameraEye 0 5 20" << std::endl;
            std::cout << "CameraAt 0 0 0" << std::endl;
            std::cout << "CameraUp 0 1 0" << std::endl;
            std::cout << "CameraFOV 30" << std::endl;
            std::cout << "Background 0.05 0.05 0.15" << std::endl << std::endl;
        }
        
        std::cout << "FrameBegin " << frame_num << std::endl;
        std::cout << "WorldBegin" << std::endl;
        
        std::cout << "AmbientLight 0.4 0.4 0.5 1.0" << std::endl;
        std::cout << "FarLight 1 1 1 1.0 1.0 1.0 1.5" << std::endl;
        std::cout << "PointLight 0 10 0 1.0 1.0 1.0 2.0" << std::endl;
        
        renderEnvironment();
        
        std::cout << "Surface \"plastic\"" << std::endl;
        
        renderFissionEvents();
        
        for (int group = 0; group < NUM_ENERGY_GROUPS; group++) {
            int count = 0;
            for (const auto& neutron : neutrons) {
                if (neutron.active && neutron.energy_group == group) count++;
            }
            
            if (count > 0) {
                std::cout << "# Energy Group " << group << " - " << count << " neutrons" << std::endl;
                
                std::cout << "Color " << GROUP_COLORS[group][0] << " " 
                          << GROUP_COLORS[group][1] << " " 
                          << GROUP_COLORS[group][2] << std::endl;
                
                for (const auto& neutron : neutrons) {
                    if (neutron.active && neutron.energy_group == group) {
                        std::cout << "XformPush" << std::endl;
                        std::cout << "Translate " << neutron.position[0] << " " 
                                  << neutron.position[1] << " " 
                                  << neutron.position[2] << std::endl;
                        
                        float size = 0.2f - group * 0.03f;
                        std::cout << "Scale " << size << " " << size << " " << size << std::endl;
                        
                        if (group == 0) {
                            std::cout << "Sphere 1.0 -1.0 1.0 360" << std::endl;
                        } 
                        else if (group == 1) {
                            std::cout << "OptionBool \"Wireframe\" true" << std::endl;
                            std::cout << "Sphere 1.0 -1.0 1.0 360" << std::endl;
                            std::cout << "OptionBool \"Wireframe\" false" << std::endl;
                        } 
                        else {
                            std::cout << "Sphere 1.0 -1.0 1.0 360" << std::endl;
                        }
                        
                        std::cout << "XformPop" << std::endl;
                    }
                }
            }
        }
        
        renderDirections();
        
        std::cout << "WorldEnd" << std::endl;
        std::cout << "FrameEnd" << std::endl << std::endl;
    }
    
private:
    /**
     * @brief Renders the static environment components of the scene
     * 
     * Creates:
     * 1. A floor plane for spatial reference
     * 2. A wireframe sphere representing the moderator region
     * 3. A bright sphere at the center representing the neutron source
     */
    void renderEnvironment() {
        std::cout << "XformPush" << std::endl;
        std::cout << "Color 0.3 0.3 0.3" << std::endl;
        std::cout << "Surface \"plastic\"" << std::endl;
        std::cout << "Translate 0 -10 0" << std::endl;
        std::cout << "Scale 20 1 20" << std::endl;
        std::cout << "Cube" << std::endl;
        std::cout << "XformPop" << std::endl << std::endl;
        
        std::cout << "XformPush" << std::endl;
        std::cout << "Color 0.3 0.8 0.3" << std::endl;
        std::cout << "Surface \"plastic\"" << std::endl;
        std::cout << "Ka 0.8" << std::endl;
        std::cout << "Kd 0.8" << std::endl;
        std::cout << "Ks 0.3" << std::endl;
        std::cout << "OptionBool \"Wireframe\" true" << std::endl;
        std::cout << "Scale 3 3 3" << std::endl;
        std::cout << "Sphere 1.0 -1.0 1.0 360" << std::endl;
        std::cout << "OptionBool \"Wireframe\" false" << std::endl;
        std::cout << "XformPop" << std::endl;
        
        std::cout << "XformPush" << std::endl;
        std::cout << "Color 1.0 1.0 0.0" << std::endl;
        std::cout << "Surface \"metal\"" << std::endl;
        std::cout << "Scale " << source_radius << " " << source_radius << " " << source_radius << std::endl;
        std::cout << "Sphere 1.0 -1.0 1.0 360" << std::endl;
        std::cout << "XformPop" << std::endl << std::endl;
    }
    
    /**
     * @brief Renders visual indicators for fission events
     * 
     * Each fission event is visualized as an expanding, fading wireframe sphere
     * with an orange-yellow glow. Events persist for 5 simulation time units,
     * during which they grow in size and fade in intensity.
     */
    void renderFissionEvents() {
        for (const auto& event : fission_events) {
            float age = simulation_time - event.time;
            if (age < 5.0f) {
                float fade = 1.0f - (age / 5.0f);
                float size = 0.5f * (1.0f + age);
                
                std::cout << "XformPush" << std::endl;
                std::cout << "Translate " << event.position[0] << " " 
                          << event.position[1] << " " 
                          << event.position[2] << std::endl;
                std::cout << "Color " << fade << " " << fade * 0.8f << " " << fade * 0.2f << std::endl;
                std::cout << "Surface \"plastic\"" << std::endl;
                std::cout << "Ka 0.8" << std::endl;
                std::cout << "Kd 0.8" << std::endl;
                std::cout << "Ks 0.5" << std::endl;
                std::cout << "OptionBool \"Wireframe\" true" << std::endl;
                std::cout << "Scale " << size << " " << size << " " << size << std::endl;
                std::cout << "Sphere 1.0 -1.0 1.0 360" << std::endl;
                std::cout << "OptionBool \"Wireframe\" false" << std::endl;
                std::cout << "XformPop" << std::endl;
            }
        }
    }
    
    /**
     * @brief Renders direction indicators for neutron movement
     * 
     * Creates line segments showing the direction of travel for active neutrons.
     * Line length is proportional to neutron energy (speed), and color matches
     * the neutron's energy group. For clarity, only a subset of neutrons
     * (maximum of MAX_DIRECTIONS) have their direction indicators displayed.
     */
    void renderDirections() {
        const int MAX_DIRECTIONS = 30;
        int count = 0;
        
        int active_count = 0;
        for (const auto& n : neutrons) {
            if (n.active) active_count++;
            if (active_count >= MAX_DIRECTIONS) break;
        }
        
        if (active_count == 0) {
            std::cout << "LineSet \"PC\"" << std::endl;
            std::cout << "0 0" << std::endl;
            return;
        }
        
        std::cout << "LineSet \"PC\"" << std::endl;
        
        std::cout << active_count * 2 << " " << active_count << std::endl;
        
        for (const auto& neutron : neutrons) {
            if (neutron.active) {
                std::cout << "  " << neutron.position[0] << " " 
                          << neutron.position[1] << " " 
                          << neutron.position[2] << " "
                          << GROUP_COLORS[neutron.energy_group][0] << " "
                          << GROUP_COLORS[neutron.energy_group][1] << " "
                          << GROUP_COLORS[neutron.energy_group][2] << std::endl;
                
                float speed = std::sqrt(GROUP_ENERGIES[neutron.energy_group]) * 0.5f;
                float end_x = neutron.position[0] + neutron.velocity[0] * speed;
                float end_y = neutron.position[1] + neutron.velocity[1] * speed;
                float end_z = neutron.position[2] + neutron.velocity[2] * speed;
                
                std::cout << "  " << end_x << " " << end_y << " " << end_z << " "
                          << GROUP_COLORS[neutron.energy_group][0] << " "
                          << GROUP_COLORS[neutron.energy_group][1] << " "
                          << GROUP_COLORS[neutron.energy_group][2] << std::endl;
                
                count++;
                if (count >= MAX_DIRECTIONS) break;
            }
        }
        
        for (int i = 0; i < count; i++) {
            std::cout << "  " << (i * 2) << " " << (i * 2 + 1) << " -1" << std::endl;
        }
    }
};

/**
 * @brief Display usage information and help for command-line arguments
 * 
 * This function outputs the available command-line options, their effects,
 * and instructions for post-processing image sequences into animations.
 * 
 * @param programName Name of the program executable (argv[0])
 */
void displayUsage(const std::string& programName) {
    std::cout << "Usage: " << programName << " [options]\n"
              << "Options:\n"
              << "  --frames N      Set number of frames to generate (default: " << num_frames << ")\n"
              << "  --neutrons N    Set number of neutrons to simulate (default: " << num_neutrons << ", min: 200)\n"
              << "  --time N        Set time step size (default: " << timestep << ")\n"
              << "  --pnm           Output to PBMPlus image files instead of screen\n"
              << "  --help          Show this help message\n\n"
              << "Animation conversion: After generating PBM files with --pnm option, you can convert\n"
              << "them into a video using FFmpeg with the following command:\n"
              << "  ffmpeg -framerate 10 -i NeutronDiffusion%04d.ppm -c:v libx264 -pix_fmt yuv420p neutron_sim.mp4\n\n"
              << "Alternatively, you can create an animated GIF using ImageMagick:\n"
              << "  convert -delay 10 -loop 0 NeutronDiffusion*.ppm neutron_sim.gif\n"
              << std::endl;
}

/**
 * @brief Main function - parses arguments and runs the simulation
 * 
 * This function:
 * 1. Processes command-line arguments
 * 2. Initializes the neutron simulation
 * 3. Runs the simulation for the specified number of frames
 * 4. Outputs each frame in RD format to stdout
 * 
 * @param argc Number of command-line arguments
 * @param argv Array of command-line argument strings
 * @return 0 on successful execution, 1 on error
 */
int main(int argc, char* argv[]) {
    bool use_pnm = false;
    
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        
        if (arg == "--frames" && i + 1 < argc) {
            num_frames = std::stoi(argv[++i]);
        }
        else if (arg == "--neutrons" && i + 1 < argc) {
            num_neutrons = std::stoi(argv[++i]);
            if (num_neutrons < 200) {
                std::cerr << "Warning: Using less than 200 neutrons may produce poor simulation results." << std::endl;
            }
        }
        else if (arg == "--time" && i + 1 < argc) {
            timestep = std::stof(argv[++i]);
        }
        else if (arg == "--pnm") {
            use_pnm = true;
        }
        else if (arg == "--help" || arg == "-h") {
            displayUsage(argv[0]);
            return 0;
        }
        else {
            std::cerr << "Error: Unknown option '" << arg << "'" << std::endl;
            displayUsage(argv[0]);
            return 1;
        }
    }
    
    NeutronSimulation simulation;
    
    for (int frame = 1; frame <= num_frames; frame++) {
        simulation.update();
        simulation.generateFrame(frame, use_pnm ? "PNM" : "Screen");
    }
    
    return 0;
}