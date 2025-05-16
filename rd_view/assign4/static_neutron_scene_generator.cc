#define _USE_MATH_DEFINES
#include <iostream>
#include <cmath>
#include <vector>
#include <random>
#include <cstdlib>

/**
 * @brief Physical and geometric constants for the reactor model
 */
const int NUM_TRACKS = 250;         // Number of neutron tracks to generate
const int POINTS_PER_TRACK = 20;    // Points along each track
const float MAX_TRACK_LENGTH = 15.0f; // Maximum length of a track
const float SOURCE_RADIUS = 0.5f;   // Radius of neutron source at center
const float CORE_RADIUS = 3.0f;     // Radius of the reactor core
const float REFLECTOR_RADIUS = 6.0f; // Radius of the reflector region
const float CURVATURE_FACTOR = 0.4f; // How much tracks curve (simulating scattering)
const float CORE_ABSORPTION = 0.1f;  // Absorption probability in core region
const float REFLECTOR_ABSORPTION = 0.4f;  // Absorption probability in reflector region
const float OUTER_ABSORPTION = 0.8f;  // Absorption probability outside reflector

/**
 * @brief Color definitions for the different reactor regions

 */
const float CORE_COLOR[3] = {1.0f, 0.3f, 0.3f};       // Red for core region
const float REFLECTOR_COLOR[3] = {0.3f, 0.7f, 1.0f};  // Blue for reflector region
const float OUTER_COLOR[3] = {1.0f, 1.0f, 0.3f};      // Yellow for outer region

/**
 * @brief Visual styling parameters
 */
const float LINE_THICKNESS = 1.5f;  // Thickness of neutron track tubes

/**
 * @brief Random number generation components for stochastic simulation
 */
std::random_device rd;  // Hardware random number source for seeding
std::mt19937 gen(rd()); // Mersenne Twister PRNG engine
std::uniform_real_distribution<float> uniform_dist(0.0f, 1.0f); // Uniform distribution [0,1]

/**
 * @brief Structure to represent a point along a neutron track
 */
struct TrackPoint {
    float position[3];  // Position in 3D space (x, y, z)
    float color[3];     // RGB color at this point (based on region)
    bool active;        // Whether this point is active (false if track ended before this point)
};

/**
 * @brief Class to represent a neutron track through the reactor model
 * 
 * This class models a complete neutron path (track) from source to absorption/escape.
 * Each track consists of multiple TrackPoint objects that store position, color,
 * and activity state along the path. The class includes functionality to generate
 * a physically plausible track with direction changes simulating scattering.
 */
class NeutronTrack {
public:
    std::vector<TrackPoint> points;  // Collection of points forming the track
    
    /**
     * @brief Constructor initializes a track with inactive points
     */
    NeutronTrack() : points(POINTS_PER_TRACK) {
        // Initialize all points as inactive
        for (auto& p : points) {
            p.active = false;
        }
    }
    
    /**
     * @brief Generate a physically plausible neutron track from source to termination
     * 
     * This method:
     * 1. Places the neutron at a random position within the source region
     * 2. Determines an initial direction vector
     * 3. Simulates movement with random direction changes (scattering)
     * 4. Assigns colors based on which region each point is in
     * 5. Probabilistically terminates the track based on region-specific absorption
     * 
     * Points are marked as "active" along the track until absorption occurs or
     * the maximum track length is reached. After absorption, remaining points
     * are left as inactive to indicate track termination.
     */
    void generate() {
        // Start at a random point within the source
        float phi = uniform_dist(gen) * 2.0f * M_PI;
        float costheta = 2.0f * uniform_dist(gen) - 1.0f;
        float sintheta = std::sqrt(1.0f - costheta * costheta);
        float r = SOURCE_RADIUS * std::pow(uniform_dist(gen), 1.0f/3.0f);
        
        float pos[3] = {
            r * sintheta * std::cos(phi),
            r * sintheta * std::sin(phi),
            r * costheta
        };
        
        // Initial direction
        float dir[3] = {
            sintheta * std::cos(phi),
            sintheta * std::sin(phi),
            costheta
        };
        
        // Randomize direction a bit
        dir[0] += (uniform_dist(gen) - 0.5f) * 0.5f;
        dir[1] += (uniform_dist(gen) - 0.5f) * 0.5f;
        dir[2] += (uniform_dist(gen) - 0.5f) * 0.5f;
        
        // Normalize direction vector
        float length = std::sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
        dir[0] /= length;
        dir[1] /= length;
        dir[2] /= length;
        
        // Initialize the first point
        points[0].position[0] = pos[0];
        points[0].position[1] = pos[1];
        points[0].position[2] = pos[2];
        
        // Determine color based on region
        float dist = std::sqrt(pos[0]*pos[0] + pos[1]*pos[1] + pos[2]*pos[2]);
        if (dist < CORE_RADIUS) {
            points[0].color[0] = CORE_COLOR[0];
            points[0].color[1] = CORE_COLOR[1];
            points[0].color[2] = CORE_COLOR[2];
        } else if (dist < REFLECTOR_RADIUS) {
            points[0].color[0] = REFLECTOR_COLOR[0];
            points[0].color[1] = REFLECTOR_COLOR[1];
            points[0].color[2] = REFLECTOR_COLOR[2];
        } else {
            points[0].color[0] = OUTER_COLOR[0];
            points[0].color[1] = OUTER_COLOR[1];
            points[0].color[2] = OUTER_COLOR[2];
        }
        
        points[0].active = true;
        
        // Generate the rest of the track points
        for (int i = 1; i < POINTS_PER_TRACK; i++) {
            // If previous point is inactive, this one should be too
            if (!points[i-1].active) {
                points[i].active = false;
                continue;
            }
            
            // Perturb direction randomly to simulate scattering
            float perturb[3] = {
                (uniform_dist(gen) * 2.0f - 1.0f) * CURVATURE_FACTOR,
                (uniform_dist(gen) * 2.0f - 1.0f) * CURVATURE_FACTOR,
                (uniform_dist(gen) * 2.0f - 1.0f) * CURVATURE_FACTOR
            };
            
            dir[0] += perturb[0];
            dir[1] += perturb[1];
            dir[2] += perturb[2];
            
            // Renormalize direction
            length = std::sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
            dir[0] /= length;
            dir[1] /= length;
            dir[2] /= length;
            
            // Calculate step length
            float step_length = MAX_TRACK_LENGTH / POINTS_PER_TRACK;
            
            // Update position
            pos[0] += dir[0] * step_length;
            pos[1] += dir[1] * step_length;
            pos[2] += dir[2] * step_length;
            
            // Copy position to point
            points[i].position[0] = pos[0];
            points[i].position[1] = pos[1];
            points[i].position[2] = pos[2];
            
            // Determine color and absorption based on region
            dist = std::sqrt(pos[0]*pos[0] + pos[1]*pos[1] + pos[2]*pos[2]);
            float absorption_prob;
            
            if (dist < CORE_RADIUS) {
                points[i].color[0] = CORE_COLOR[0];
                points[i].color[1] = CORE_COLOR[1];
                points[i].color[2] = CORE_COLOR[2];
                absorption_prob = CORE_ABSORPTION;
            } else if (dist < REFLECTOR_RADIUS) {
                points[i].color[0] = REFLECTOR_COLOR[0];
                points[i].color[1] = REFLECTOR_COLOR[1];
                points[i].color[2] = REFLECTOR_COLOR[2];
                absorption_prob = REFLECTOR_ABSORPTION;
            } else {
                points[i].color[0] = OUTER_COLOR[0];
                points[i].color[1] = OUTER_COLOR[1];
                points[i].color[2] = OUTER_COLOR[2];
                absorption_prob = OUTER_ABSORPTION;
            }
            
            // Determine if track continues or is absorbed
            if (uniform_dist(gen) < absorption_prob) {
                points[i].active = true;  // This point is active
                // All subsequent points are inactive (track ends)
                for (int j = i + 1; j < POINTS_PER_TRACK; j++) {
                    points[j].active = false;
                }
                break;
            }
            
            points[i].active = true;
        }
    }
};

/**
 * @brief Class to manage the collection and visualization of neutron tracks
 * 
 * This class maintains a collection of NeutronTrack objects and handles
 * generating the complete RD (Render Description) scene file, including:
 * - Scene setup and camera parameters
 * - Lighting configuration
 * - Visualization of reactor regions (core, reflector)
 * - Rendering all neutron tracks as tubes
 */
class NeutronTracks {
private:
    std::vector<NeutronTrack> tracks;  // Collection of all neutron tracks
    
public:
    /**
     * @brief Constructor generates all neutron tracks
     */
    NeutronTracks() {
        tracks.resize(NUM_TRACKS);
        
        // Generate all tracks
        for (auto& track : tracks) {
            track.generate();
        }
    }
    
    /**
     * @brief Generate complete RD scene description for visualization
     * 
     * Outputs a complete scene file in RD format with:
     * 1. Scene header, camera settings, and background
     * 2. Lighting setup with ambient, directional, and point lights
     * 3. Wireframe visualization of core and reflector boundaries
     * 4. Source point representation at the center
     * 5. All neutron tracks rendered as colored tubes
     * 
     * The scene is structured to provide optimal visibility of the reactor
     * regions and neutron paths with appropriate lighting and colors.
     */
    void generateRDScene() {
        // Write scene header
        std::cout << "# Neutron Tracks Visualization Scene" << std::endl;
        std::cout << "Display \"Neutron Tracks Visualization\" \"Screen\" \"rgbsingle\"" << std::endl;
        std::cout << "Format 800 600" << std::endl;
        std::cout << "OptionReal \"Divisions\" 20" << std::endl << std::endl;
        
        // Camera setup for a good view of the tracks
        std::cout << "CameraEye 0 15 15" << std::endl;
        std::cout << "CameraAt 0 0 0" << std::endl;
        std::cout << "CameraUp 0 1 0" << std::endl;
        std::cout << "CameraFOV 40" << std::endl;
        std::cout << "Clipping 0.1 1000" << std::endl << std::endl;
        
        // Background color (slightly brighter for better visibility)
        std::cout << "Background 0.05 0.05 0.12" << std::endl << std::endl;
        
        // Start the world
        std::cout << "WorldBegin" << std::endl;
        
        // Enhanced lighting for the scene - stronger for better visibility
        std::cout << "# Base ambient light to illuminate everything" << std::endl;
        std::cout << "AmbientLight 0.6 0.6 0.65 1.0" << std::endl;
        
        std::cout << "# Primary directional light" << std::endl;
        std::cout << "FarLight 1 1 1 1.0 1.0 1.0 1.5" << std::endl;
        
        std::cout << "# Point lights to highlight areas" << std::endl;
        std::cout << "PointLight 10 15 10 1.0 1.0 1.0 1.8" << std::endl;
        std::cout << "PointLight -10 15 -10 0.9 0.9 1.0 1.8" << std::endl;
        std::cout << "PointLight 0 15 0 1.0 1.0 0.9 2.0" << std::endl;
        
        std::cout << "# Source light at the center - increased intensity" << std::endl;
        std::cout << "PointLight 0 0 0 1.0 0.8 0.6 1.5" << std::endl << std::endl;
        
        // Draw the core boundary as a wireframe
        std::cout << "# Core region boundary - wireframe for transparency" << std::endl;
        std::cout << "XformPush" << std::endl;
        std::cout << "Color " << CORE_COLOR[0] << " " << CORE_COLOR[1] << " " << CORE_COLOR[2] << std::endl;
        std::cout << "Surface \"metal\"" << std::endl;
        std::cout << "Ka 1.0" << std::endl;
        std::cout << "Kd 0.7" << std::endl;
        std::cout << "Ks 1.0" << std::endl;
        std::cout << "Specular 1.0 1.0 1.0 20" << std::endl;
        
        // Wireframe Core
        std::cout << "OptionBool \"Wireframe\" true" << std::endl;
        std::cout << "Sphere " << CORE_RADIUS << " -" << CORE_RADIUS << " " << CORE_RADIUS << " 360" << std::endl;
        std::cout << "OptionBool \"Wireframe\" false" << std::endl;
        std::cout << "XformPop" << std::endl << std::endl;
        
        // Draw the reflector boundary as a wireframe
        std::cout << "# Reflector region boundary - wireframe for transparency" << std::endl;
        std::cout << "XformPush" << std::endl;
        std::cout << "Color " << REFLECTOR_COLOR[0] << " " << REFLECTOR_COLOR[1] << " " << REFLECTOR_COLOR[2] << std::endl;
        std::cout << "Surface \"metal\"" << std::endl;
        std::cout << "Ka 0.7" << std::endl;
        std::cout << "Kd 0.0" << std::endl;
        std::cout << "Ks 1.0" << std::endl;
        std::cout << "Specular 1.0 1.0 1.0 15" << std::endl;
        
        // Wireframe Reflector
        std::cout << "OptionBool \"Wireframe\" true" << std::endl;
        std::cout << "Sphere " << REFLECTOR_RADIUS << " -" << REFLECTOR_RADIUS << " " << REFLECTOR_RADIUS << " 360" << std::endl;
        std::cout << "OptionBool \"Wireframe\" false" << std::endl;
        std::cout << "XformPop" << std::endl << std::endl;
        
        // Source visible point at center
        std::cout << "# Source point at center" << std::endl;
        std::cout << "XformPush" << std::endl;
        std::cout << "Color 1.0 0.9 0.5" << std::endl;
        std::cout << "Translate 0 0 0" << std::endl;
        std::cout << "Scale 0.3 0.3 0.3" << std::endl;
        std::cout << "Sphere 1 -1 1 360" << std::endl;
        std::cout << "XformPop" << std::endl << std::endl;
        
        // Calculate total number of active points and active line segments
        int total_active_points = 0;
        int total_line_segments = 0;
        
        for (const auto& track : tracks) {
            TrackPoint prev_point;
            bool has_prev = false;
            
            for (const auto& point : track.points) {
                if (point.active) {
                    total_active_points++;
                    
                    if (has_prev) {
                        total_line_segments++;
                    }
                    
                    has_prev = true;
                    prev_point = point;
                } else {
                    has_prev = false;
                }
            }
        }
        
        // Draw all neutron tracks - create multiple tube segments to imitate thick lines
        std::cout << "# Neutron track tubes (" << total_line_segments << " tube segments)" << std::endl;
        
        // Enhanced drawing approach for better visibility:
        // Instead of LineSet, use Tubes or explicit line segments with thickness
        for (const auto& track : tracks) {
            TrackPoint prev_point;
            // Initialize prev_point to avoid uninitialized variable warnings
            prev_point.position[0] = 0.0f;
            prev_point.position[1] = 0.0f;
            prev_point.position[2] = 0.0f;
            prev_point.color[0] = 0.0f;
            prev_point.color[1] = 0.0f;
            prev_point.color[2] = 0.0f;
            prev_point.active = false;
            
            bool has_prev = false;
            
            for (const auto& point : track.points) {
                if (point.active) {
                    if (has_prev) {
                        // Draw a thin tube between points to represent the track
                        std::cout << "XformPush" << std::endl;
                        std::cout << "Color " 
                            << point.color[0] << " " 
                            << point.color[1] << " " 
                            << point.color[2] << std::endl;
                        std::cout << "Surface \"plastic\"" << std::endl;
                        std::cout << "Ka 0.8" << std::endl;
                        std::cout << "Kd 0.8" << std::endl;
                        std::cout << "Ks 0.3" << std::endl;
                        
                        // Tube from prev point to current point
                        float start[3] = {prev_point.position[0], prev_point.position[1], prev_point.position[2]};
                        float end[3] = {point.position[0], point.position[1], point.position[2]};
                        
                        // Use tube with thickness
                        std::cout << "Tube " 
                            << start[0] << " " << start[1] << " " << start[2] << " "
                            << end[0] << " " << end[1] << " " << end[2] << " "
                            << LINE_THICKNESS / 40.0 << std::endl;
                            
                        std::cout << "XformPop" << std::endl;
                    }
                    
                    has_prev = true;
                    prev_point = point;
                } else {
                    has_prev = false;
                }
            }
        }
        
        // End the world
        std::cout << "WorldEnd" << std::endl;
    }
};

/**
 * @brief Main entry point for the program
 * 
 * Creates a NeutronTracks object to generate neutron tracks and outputs
 * a complete RD scene description to standard output, which can be
 * redirected to a file for visualization.
 * 
 * @return 0 on successful execution
 */
int main() {
    // Create the neutron tracks visualization
    NeutronTracks tracks;
    
    // Generate the RD scene file
    tracks.generateRDScene();
    
    return 0;
}