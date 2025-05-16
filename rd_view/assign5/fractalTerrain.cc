#include <iostream>
#include <fstream>
#include <cmath>
#include <random>    // For Mersenne Twister
#include <string>
#include <vector>
#include <algorithm>


class FractalTerrain {
private:
    int n;                  // Grid size will be 2^n + 1
    double D;               // Fractal dimension (2.0-3.0)
    double H;               // Hurst exponent (H = 3 - D)
    int seed;               // Random seed
    double sigma;           // Initial standard deviation
    std::vector<std::vector<double>> grid;  // 2D grid for terrain heights
    std::mt19937 rng;       // Mersenne Twister
    std::normal_distribution<double> gauss; // True Gaussian distribution

    /**
     * Returns a single Gaussian random number
     * Convenient wrapper around the distribution object
     */
    double Gauss() {
        return gauss(rng);
    }

    /**
     * Sets up the Gaussian RNG with the specified seed
     * (Note: This is essential for reproducible results)
     */
    void InitGauss(int seed) {
        rng.seed(seed);
        gauss = std::normal_distribution<double>(0.0, 1.0);  // mean 0, stddev 1
    }

    /**
     * Helper function for three-point average plus random displacement
     * Used for boundary edges where we only have 3 neighbor points
     * 
     * @param delta The current standard deviation for random displacement
     * @param x0, x1, x2 The three height values to average
     */
    double f3(double delta, double x0, double x1, double x2) {
        return (x0 + x1 + x2) / 3.0 + delta * Gauss();
    }

    /**
     * Helper function for four-point average plus random displacement
     * Used for interior points where we have 4 neighbor points
     * 
     * @param delta The current standard deviation for random displacement
     * @param x0, x1, x2, x3 The four height values to average
     */
    double f4(double delta, double x0, double x1, double x2, double x3) {
        return (x0 + x1 + x2 + x3) / 4.0 + delta * Gauss();
    }

public:
    /**
     * Constructor - sets up parameters and generates the terrain
     * 
     * @param n_val Grid size parameter (grid will be 2^n + 1)
     * @param D_val Fractal dimension (roughness factor between 2.0 and 3.0)
     * @param seed_val Random seed for reproducible terrains
     * @param sigma_val Initial standard deviation (height scale factor)
     */
    FractalTerrain(int n_val, double D_val, int seed_val, double sigma_val) 
        : n(n_val), D(D_val), seed(seed_val), sigma(sigma_val) {
        H = 3.0 - D;  // Calculate Hurst exponent from fractal dimension
        
        // Grid size is 2^n + 1 - bit shift is faster than pow()
        int size = (1 << n) + 1;
        
        // Initialize grid with zeros
        grid.resize(size, std::vector<double>(size, 0.0));
        
        generateTerrain();
    }

    /**
     * The core terrain generation algorithm
     * 
     * This implements the midpoint displacement method based on the pseudocode
     * from class. The algorithm works in stages:
     * 1. Initialize corners with random values
     * 2. Iteratively subdivide the grid
     * 3. For each subdivision, calculate midpoints with random displacements
     * 4. Reduce the random displacement factor each iteration (delta)
     */
    void generateTerrain() {
        int N = (1 << n);  // N = 2^n - max grid index
        
        InitGauss(seed);  // Initialize our RNG with the seed
        
        // Step 1: Set initial random values at the four corners
        double delta = sigma;  // Initial random displacement magnitude
        grid[0][0] = delta * Gauss();
        grid[0][N] = delta * Gauss();
        grid[N][0] = delta * Gauss();
        grid[N][N] = delta * Gauss();
        
        // These track the current grid step sizes
        int D = N;      // Full step size
        int d = N / 2;  // Half step size
        
        // Main algorithm loop - each iteration subdivides the grid further
        for (int stage = 1; stage <= n; stage++) {
            // Reduce the random variation according to our fractal dimension
            delta = delta * pow(0.5, 0.5 * H);
            
            // Calculate values at the center of each square
            for (int x = d; x < N; x += D) {
                for (int y = d; y < N; y += D) {
                    // Average the four corners plus random displacement
                    grid[x][y] = f4(delta, grid[x+d][y+d], grid[x+d][y-d], 
                                    grid[x-d][y+d], grid[x-d][y-d]);
                }
            }
            
            // Apply additional randomness to existing points for more natural look
            for (int x = 0; x <= N; x += D) {
                for (int y = 0; y <= N; y += D) {
                    grid[x][y] = grid[x][y] + delta * Gauss();
                }
            }
            
            // Further reduce the random variation
            delta = delta * pow(0.5, 0.5 * H);
            
            // Calculate values at the midpoint of each edge
            // Handle boundary points specially (only 3 neighbors instead of 4)
            for (int x = d; x < N; x += D) {
                // Bottom edge
                grid[x][0] = f3(delta, grid[x+d][0], grid[x-d][0], grid[x][d]);
                // Top edge
                grid[x][N] = f3(delta, grid[x+d][N], grid[x-d][N], grid[x][N-d]);
                // Left edge
                grid[0][x] = f3(delta, grid[0][x+d], grid[0][x-d], grid[d][x]);
                // Right edge
                grid[N][x] = f3(delta, grid[N][x+d], grid[N][x-d], grid[N-d][x]);
            }
            
            // Calculate values at the midpoint of interior edges 
            for (int x = d; x < N; x += D) {
                for (int y = D; y < N; y += D) {
                    grid[x][y] = f4(delta, grid[x][y+d], grid[x][y-d], 
                                    grid[x+d][y], grid[x-d][y]);
                }
            }
            
            for (int x = D; x < N; x += D) {
                for (int y = d; y < N; y += D) {
                    grid[x][y] = f4(delta, grid[x][y+d], grid[x][y-d], 
                                    grid[x+d][y], grid[x-d][y]);
                }
            }
            
            // Add more randomization to existing points
            for (int x = 0; x <= N; x += D) {
                for (int y = 0; y <= N; y += D) {
                    grid[x][y] = grid[x][y] + delta * Gauss();
                }
            }
            
            for (int x = d; x < N; x += D) {
                for (int y = d; y < N; y += D) {
                    grid[x][y] = grid[x][y] + delta * Gauss();
                }
            }
            
            // Prepare for next iteration - halve the step sizes
            D = D / 2;
            d = d / 2;
        }
    }

    /**
     * Maps height values to colors using smooth transitions
     * 
     * This creates a nice color gradient effect based on height:
     * - Deep blue for deep water
     * - Light blue for shallow water
     * - Sandy beach at the water's edge
     * - Green for grassy plains
     * - Brown for mountains
     * - White for snow-capped peaks
     * 
     * Uses linear interpolation between colors to create smooth transitions
     * between different terrain types rather than harsh boundaries.
     * 
     * @param height The terrain height value at a given point
     * @return An RGB color vector (r,g,b) with values 0.0-1.0
     */
    std::vector<double> getColor(double height) {
        // Find min and max heights to normalize colors (calculate once and cache)
        // Static variables so we only compute this once - massive performance boost
        static double minHeight = 0.0;
        static double maxHeight = 0.0;
        static bool heightsCalculated = false;
        
        if (!heightsCalculated) {
            minHeight = grid[0][0];
            maxHeight = grid[0][0];
            
            // Find the actual min/max across the whole terrain
            for (const auto& row : grid) {
                for (const auto& val : row) {
                    minHeight = std::min(minHeight, val);
                    maxHeight = std::max(maxHeight, val);
                }
            }
            heightsCalculated = true;  // Only do this calculation once!
        }
        
        // Map height to [0,1] range for easier threshold comparisons
        double normalizedHeight = (height - minHeight) / (maxHeight - minHeight);
        
        // Define transition widths for smoother color blending
        // Smaller blend width = sharper transitions, larger = smoother gradient
        const double blendWidth = 0.03; // Width of transition zone (3% of total height range)
        std::vector<double> color(3);  // Our RGB result
        
        // Define thresholds for different terrain types
        // These can be tweaked to change the distribution of terrain features
        const double deepWaterThresh = 0.20;    // Bottom 20% = deep water
        const double shallowWaterThresh = 0.30; // Next 10% = shallow water
        const double sandThresh = 0.40;         // Next 10% = sandy beaches
        const double grassThresh = 0.60;        // Next 20% = grass/plains
        const double mountainThresh = 0.80;     // Next 20% = mountains
                                               // Last 20% = snowy peaks
        
        // Define colors for each terrain type (RGB values)
        const std::vector<double> deepWaterColor = {0.0, 0.0, 0.5};    // Deep blue
        const std::vector<double> shallowWaterColor = {0.0, 0.0, 0.8}; // Light blue
        const std::vector<double> sandColor = {0.76, 0.7, 0.5};        // Sand/beach
        const std::vector<double> grassColor = {0.0, 0.6, 0.0};        // Green
        const std::vector<double> mountainColor = {0.5, 0.35, 0.05};   // Brown
        const std::vector<double> snowColor = {1.0, 1.0, 1.0};         // White
        
        // Helper function for linear interpolation between two values
        // t should be in range [0,1] to smoothly transition from a to b
        auto lerp = [](double t, double a, double b) -> double {
            return a + t * (b - a);
        };
        
        // Helper function to interpolate between two color vectors
        auto colorLerp = [&lerp](double t, const std::vector<double>& a, const std::vector<double>& b) -> std::vector<double> {
            std::vector<double> result(3);
            for (int i = 0; i < 3; i++) {
                result[i] = lerp(t, a[i], b[i]);
            }
            return result;
        };
        
        // The big if-else ladder for coloring
        // Each terrain type has a pure region and a blended transition region
        
        // Deep water (lowest points)
        if (normalizedHeight < deepWaterThresh - blendWidth) {
            color = deepWaterColor;
        } 
        // Transition from deep to shallow water
        else if (normalizedHeight < deepWaterThresh + blendWidth) {
            double t = (normalizedHeight - (deepWaterThresh - blendWidth)) / (2 * blendWidth);
            color = colorLerp(t, deepWaterColor, shallowWaterColor);
        }
        // Shallow water
        else if (normalizedHeight < shallowWaterThresh - blendWidth) {
            color = shallowWaterColor;
        }
        // Transition from shallow water to sand
        else if (normalizedHeight < shallowWaterThresh + blendWidth) {
            double t = (normalizedHeight - (shallowWaterThresh - blendWidth)) / (2 * blendWidth);
            color = colorLerp(t, shallowWaterColor, sandColor);
        }
        // Sandy beaches
        else if (normalizedHeight < sandThresh - blendWidth) {
            color = sandColor;
        }
        // Transition from sand to grass
        else if (normalizedHeight < sandThresh + blendWidth) {
            double t = (normalizedHeight - (sandThresh - blendWidth)) / (2 * blendWidth);
            color = colorLerp(t, sandColor, grassColor);
        }
        // Grassy plains
        else if (normalizedHeight < grassThresh - blendWidth) {
            color = grassColor;
        }
        // Transition from grass to mountain
        else if (normalizedHeight < grassThresh + blendWidth) {
            double t = (normalizedHeight - (grassThresh - blendWidth)) / (2 * blendWidth);
            color = colorLerp(t, grassColor, mountainColor);
        }
        // Mountains
        else if (normalizedHeight < mountainThresh - blendWidth) {
            color = mountainColor;
        }
        // Transition from mountain to snow
        else if (normalizedHeight < mountainThresh + blendWidth) {
            double t = (normalizedHeight - (mountainThresh - blendWidth)) / (2 * blendWidth);
            color = colorLerp(t, mountainColor, snowColor);
        }
        // Snowy peaks (highest points)
        else {
            color = snowColor;
        }
        
        return color;
    }

    /**
     * Exports the terrain as a PolySet in RD file format
     * 
     * This creates a complete RD file that can be rendered with rd_view.
     * The terrain is scaled to 100x100 world units regardless of subdivision
     * level, and includes proper camera and lighting setup for good visualization.
     * 
     * The output format follows the RD spec with:
     * - Vertices with positions and colors
     * - Triangle faces defined by vertex indices
     * - Camera and lighting setup for proper viewing
     * 
     * @param filename The output filename (should end in .rd)
     */
    void exportToRD(const std::string& filename) {
        std::ofstream outFile(filename);
        if (!outFile.is_open()) {
            std::cerr << "Error: Could not open file for writing: " << filename << std::endl;
            return;
        }
        
        int size = grid.size();
        double scale = 100.0 / (size - 1);  // Scale to 100 world units regardless of grid size
        
        // Calculate min/max heights for the header info (not actually used but nice to have)
        double minHeight = grid[0][0];
        double maxHeight = grid[0][0];
        
        for (const auto& row : grid) {
            for (const auto& val : row) {
                minHeight = std::min(minHeight, val);
                maxHeight = std::max(maxHeight, val);
            }
        }
        
        // Write RD file header comments
        outFile << "# Fractal Terrain PolySet\n";
        outFile << "# Generated with parameters: n=" << n << " D=" << D << " seed=" << seed << " sigma=" << sigma << "\n\n";
        
        // Write display parameters - screen size settings
        outFile << "Display \"Fractal Terrain\" \"Screen\" \"rgbdouble\"\n";
        outFile << "Format 800 600\n\n";
        
        // Camera setup
        outFile << "# Camera Settings\n";
        outFile << "CameraEye 150 150 50\n";   // Camera position
        outFile << "CameraAt 50 50 -18\n";     // Look at point
        outFile << "CameraUp 0 0 1\n";         // Z-up orientation
        outFile << "CameraFOV 38\n\n";         // Field of view
        
        // Start the actual scene content
        outFile << "WorldBegin\n";
        
        // Lighting setup
        outFile << "# Lighting Settings\n";
        outFile << "AmbientLight 0.6 0.6 0.6 1.0\n";      // Bright ambient so shadows aren't too dark
        outFile << "FarLight 0 0 1 1.0 1.0 1.0 1.0\n";    // Main light from above
        outFile << "FarLight 1 1 -1 0.7 0.7 0.7 0.5\n\n"; // Fill light from an angle
        
        // Material settings
        outFile << "# Surface settings\n";
        outFile << "Surface \"matte\"\n";  // Simple matte shader
        outFile << "Ka 0.8\n";             // High ambient
        outFile << "Kd 0.7\n\n";           // Medium diffuse
        
        // Begin defining the actual geometry
        outFile << "PolySet \"PC\"\n";
        outFile << size * size << " " << (size-1) * (size-1) * 2 << "\n";
        
        // Write all vertex data (positions and colors)
        // Format: x y z r g b
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                double xPos = x * scale;
                double yPos = y * scale;
                double zPos = grid[y][x];  // Height is z-coordinate
                
                std::vector<double> color = getColor(zPos);
                outFile << xPos << " " << yPos << " " << zPos << " " 
                       << color[0] << " " << color[1] << " " << color[2] << "\n";
            }
        }
        
        // Generate triangle faces - two triangles per grid cell
        for (int y = 0; y < size - 1; y++) {
            for (int x = 0; x < size - 1; x++) {
                // Compute vertex indices for this grid cell
                int v0 = y * size + x;           // Bottom-left vertex
                int v1 = y * size + (x + 1);     // Bottom-right vertex
                int v2 = (y + 1) * size + x;     // Top-left vertex
                int v3 = (y + 1) * size + (x + 1); // Top-right vertex
                
                // First triangle (bottom-left, bottom-right, top-left)
                outFile << v0 << " " << v1 << " " << v2 << " -1\n";
                // Second triangle (bottom-right, top-right, top-left)
                outFile << v1 << " " << v3 << " " << v2 << " -1\n";
            }
        }
        
        // Close out the scene
        outFile << "WorldEnd\n";
        
        outFile.close();
        std::cout << "Terrain successfully exported to " << filename << std::endl;
    }
};

/**
 * Main program - handles user input and terrain generation
 * 
 * Asks the user for the terrain parameters:
 * - n: Grid size will be 2^n + 1 (larger = more detailed but slower)
 * - D: Fractal dimension (higher = rougher terrain)
 * - seed: Random seed (same seed produces identical terrain)
 * - sigma: Initial height variation (larger = more extreme heights)
 * 
 * Generates the terrain and exports it as an RD file for rendering.
 */
int main() {
    int n, seed;
    double D, sigma;
    
    // Get terrain parameters from user
    std::cout << "Enter n (grid size will be 2^n + 1): ";
    std::cin >> n;
    
    std::cout << "Enter D (fractal dimension 2.0-3.0): ";
    std::cin >> D;
    while (D < 2.0 || D > 3.0) {
        std::cout << "D must be between 2.0 and 3.0. Try again: ";
        std::cin >> D;
    }
    
    std::cout << "Enter seed value: ";
    std::cin >> seed;
    
    std::cout << "Enter sigma (initial standard deviation): ";
    std::cin >> sigma;
    
    // Create output filename - format: tNdD_Dsxxx.rd
    // Example: t7d2_5s123.rd = n=7, D=2.5, seed=123
    char dBuf[8];
    sprintf(dBuf, "%.1f", D);  // Format D with one decimal place
    
    // Replace decimal point with underscore to avoid having two periods in the filename
    std::string dStr = std::string(dBuf);
    std::replace(dStr.begin(), dStr.end(), '.', '_');
    
    // Build the final filename - shows params in the filename for easy reference later
    std::string filename = "t" + std::to_string(n) + 
                          "d" + dStr + 
                          "s" + std::to_string(seed % 1000) + ".rd";
    
    // Generate and export the terrain
    std::cout << "Generating fractal terrain..." << std::endl;
    FractalTerrain terrain(n, D, seed, sigma);
    
    std::cout << "Exporting to RD file..." << std::endl;
    terrain.exportToRD(filename);
    
    return 0;
}