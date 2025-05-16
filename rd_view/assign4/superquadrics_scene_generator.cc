#include <iostream>     // For standard output
#include <cmath>        // For mathematical functions (sin, cos, etc.)
#include <vector>       // For storing collections of objects
#include <random>       // For generating random positions and parameters
#include <algorithm>    // For algorithms like min/max
#include <string>       // For string manipulation
#include <cstdlib>      // For atoi, using command-line arguments

// Enum for object types to avoid string comparisons
// This improves code readability and performance
enum class ObjectType {
    RegularSphere,      // Regular sphere primitive (not superquadric)
    SuperquadricSphere, // Sphere with superquadric parameters
    Torus               // Superquadric torus
};

// Enum for surface types
// Controls material properties for different visual effects
enum class SurfaceType {
    Matte,   // Non-reflective surface (diffuse only)
    Plastic, // Semi-reflective surface (mixed diffuse and specular)
    Metal    // Highly reflective surface (strong specular component)
};

// Structure to store parameters for our celestial objects
// This class encapsulates all properties needed to define and render a celestial object
struct CelestialObject {
    float x, y, z;           // Position in 3D space
    float rotX, rotY, rotZ;  // Rotation angles for each axis (in degrees)
    float scaleX, scaleY, scaleZ; // Size scaling factors for each axis
    float northParam;        // North parameter for superquadric (controls vertical shape)
    float eastParam;         // East parameter for superquadric (controls horizontal shape)
    float r, g, b;           // RGB color values (range 0.0-1.0)
    ObjectType type;         // Type of object (enum)
    
    // For torus-specific parameters
    float radius1;           // Main radius (distance from center to tube center)
    float radius2;           // Tube radius (thickness of the tube)
    
    // For light emission (sun and bright stars)
    bool emitsLight;         // Whether object emits light
    float lightIntensity;    // Light intensity if emitting
    
    // Surface properties
    SurfaceType surfaceType; // Type of surface (enum)
    float ka, kd, ks;        // Surface reflection coefficients (ambient, diffuse, specular)
    float specR, specG, specB, specExp; // Specular color and exponent (shininess)
    
    // Constructor with defaults
    // Initializes all object properties with reasonable defaults
    CelestialObject() : 
        x(0), y(0), z(0), 
        rotX(0), rotY(0), rotZ(0),
        scaleX(1.0), scaleY(1.0), scaleZ(1.0),
        northParam(1.0), eastParam(1.0),
        r(1.0), g(1.0), b(1.0),
        type(ObjectType::SuperquadricSphere),
        radius1(0), radius2(0),
        emitsLight(false), lightIntensity(0),
        surfaceType(SurfaceType::Plastic),
        ka(0.3), kd(0.9), ks(0.5),
        specR(0.8), specG(0.8), specB(0.8), specExp(10) {}
        
    // Helper methods to initialize properties in a fluent style
    // This allows for method chaining, which simplifies object creation
    
    // Set position in 3D space
    CelestialObject& setPosition(float x_, float y_, float z_) {
        x = x_; y = y_; z = z_;
        return *this;
    }
    
    // Set rotation angles for all three axes
    CelestialObject& setRotation(float rotX_, float rotY_, float rotZ_) {
        rotX = rotX_; rotY = rotY_; rotZ = rotZ_;
        return *this;
    }
    
    // Set uniform scale for all dimensions
    CelestialObject& setScale(float scale) {
        return setScale(scale, scale, scale);
    }
    
    // Set individual scale for each dimension
    CelestialObject& setScale(float scaleX_, float scaleY_, float scaleZ_) {
        scaleX = scaleX_; scaleY = scaleY_; scaleZ = scaleZ_;
        return *this;
    }
    
    // Set RGB color
    CelestialObject& setColor(float r_, float g_, float b_) {
        r = r_; g = g_; b = b_;
        return *this;
    }
    
    // Set superquadric parameters that control shape
    CelestialObject& setParameters(float north, float east) {
        northParam = north; eastParam = east;
        return *this;
    }
    
    // Set light emission properties
    CelestialObject& setLight(bool emits, float intensity = 0) {
        emitsLight = emits; lightIntensity = intensity;
        return *this;
    }
    
    // Set surface material properties
    CelestialObject& setSurface(SurfaceType type, float ka_, float kd_, float ks_) {
        surfaceType = type;
        ka = ka_; kd = kd_; ks = ks_;
        return *this;
    }
    
    // Set specular highlight properties
    CelestialObject& setSpecular(float r_, float g_, float b_, float exp_) {
        specR = r_; specG = g_; specB = b_; specExp = exp_;
        return *this;
    }
    
    // Set object to be a torus with given radii
    CelestialObject& setTorus(float r1, float r2) {
        type = ObjectType::Torus;
        radius1 = r1; radius2 = r2;
        return *this;
    }
};

const float MIN_STAR_DISTANCE = 6.0f;        // Minimum distance from origin for stars
const float REGULAR_STAR_MIN_SCALE = 0.03f;  // Minimum scale for regular stars
const float REGULAR_STAR_MAX_SCALE = 0.08f;  // Maximum scale for regular stars
const float SQ_STAR_MIN_SCALE = 0.08f;       // Minimum scale for superquadric stars
const float SQ_STAR_MAX_SCALE = 0.15f;       // Maximum scale for superquadric stars
const float LIGHT_STAR_MIN_SCALE = 0.18f;    // Minimum scale for light-emitting stars
const float LIGHT_STAR_MAX_SCALE = 0.25f;    // Maximum scale for light-emitting stars

/**
 * @brief Generate a random float between min and max
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @return Random float between min and max
 */
float randomFloat(float min, float max) {
    static std::random_device rd;  // Hardware random number source for seed
    static std::mt19937 gen(rd()); // Mersenne Twister generator
    std::uniform_real_distribution<float> dis(min, max); // Uniform distribution
    return dis(gen);
}

/**
 * @brief Factory method to create a sun object
 * 
 * Creates a central sun with appropriate light emission properties
 * 
 * @param intensity Light intensity of the sun
 * @return A fully configured sun object
 */
CelestialObject createSun(float intensity = 12.0f) {
    return CelestialObject()
        .setPosition(0, 0, 0)
        .setScale(1.0f)
        .setParameters(0.3f, 0.3f)  // Slightly star-like shape
        .setColor(1.0f, 1.0f, 0.7f) // Warm yellow color
        .setLight(true, intensity)   // Emits light
        .setSurface(SurfaceType::Metal, 1.0f, 1.0f, 0.2f) // Metallic surface
        .setSpecular(1.0f, 1.0f, 0.7f, 10); // Warm specular highlight
}

/**
 * @brief Factory method to create a planet object
 * 
 * Creates a planet with customizable position, size, shape, and color
 * 
 * @param x,y,z Position in 3D space
 * @param scale Overall scale factor
 * @param north North parameter for vertical shape control
 * @param east East parameter for horizontal shape control
 * @param r,g,b RGB color values
 * @return A fully configured planet object
 */
CelestialObject createPlanet(float x, float y, float z, float scale, float north, float east,
                           float r, float g, float b) {
    return CelestialObject()
        .setPosition(x, y, z)
        .setScale(scale)
        .setParameters(north, east)
        .setColor(r, g, b)
        .setSurface(SurfaceType::Plastic, 0.3f, 0.9f, 0.5f) // Plastic-like surface
        .setSpecular(0.8f, 0.8f, 0.8f, 10); // White specular highlight
}

/**
 * @brief Factory method to create a ring object
 * 
 * Creates a torus object suitable for planetary rings or other ring-like structures
 * 
 * @param angleX X-axis rotation angle
 * @param angleY Y-axis rotation angle
 * @param radius1 Main radius (distance from center to tube center)
 * @param radius2 Tube radius (thickness of the tube)
 * @param northParam North parameter for torus shape
 * @param eastParam East parameter for torus shape
 * @param r,g,b RGB color values
 * @return A fully configured ring object
 */
CelestialObject createRing(float angleX, float angleY, float radius1, float radius2, 
                          float northParam, float eastParam, float r, float g, float b) {
    return CelestialObject()
        .setPosition(0, 0, 0)        // Centered at origin
        .setRotation(angleX, angleY, 0) // Tilted for visual interest
        .setParameters(northParam, eastParam)
        .setColor(r, g, b)
        .setTorus(radius1, radius2)  // Set up as a torus
        .setSurface(SurfaceType::Plastic, 0.15f, 0.7f, 0.3f)
        .setSpecular(0.4f, 0.4f, 0.6f, 8); // Subtle blue specular
}

/**
 * @brief Set position based on spherical coordinates
 * 
 * Helper function to convert from spherical to Cartesian coordinates
 * 
 * @param obj Object to update
 * @param radius Distance from origin
 * @param theta Polar angle (0 to π)
 * @param phi Azimuthal angle (0 to 2π)
 */
void setPositionFromSpherical(CelestialObject& obj, float radius, float theta, float phi) {
    obj.x = radius * sin(theta) * cos(phi);
    obj.y = radius * sin(theta) * sin(phi);
    obj.z = radius * cos(theta);
}

/**
 * @brief Render a celestial object to RD format
 * 
 * Outputs RD commands to create the specified object with all its properties
 * 
 * @param obj Object to render
 */
void renderObject(const CelestialObject& obj) {
    // Emit light if needed (before object geometry)
    if (obj.emitsLight) {
        std::cout << "# Light source at position " << obj.x << ", " << obj.y << ", " << obj.z << std::endl;
        std::cout << "PointLight " << obj.x << " " << obj.y << " " << obj.z << " "
                  << obj.r << " " << obj.g << " " << obj.b << " "
                  << obj.lightIntensity << std::endl << std::endl;
    }

    // Common initial setup for all objects
    std::cout << "XformPush" << std::endl;
    std::cout << "    Translate " << obj.x << " " << obj.y << " " << obj.z << std::endl;
    
    // Special case for sun
    if (obj.emitsLight && obj.x == 0 && obj.y == 0 && obj.z == 0) {
        std::cout << "    # Special emissive effect for the sun" << std::endl;
        std::cout << "    Color 1.0 0.9 0.4" << std::endl;
        std::cout << "    Surface \"matte\"" << std::endl;
        std::cout << "    Ka 1.0" << std::endl;
        std::cout << "    Kd 1.0" << std::endl;
        std::cout << "    Ks 0.3" << std::endl;
        std::cout << "    Specular 1.0 0.9 0.5 5" << std::endl;
    } else {
        // Common surface properties
        std::cout << "    Color " << obj.r << " " << obj.g << " " << obj.b << std::endl;
        std::cout << "    Surface \"" << (obj.surfaceType == SurfaceType::Metal ? "metal" : 
                                        obj.surfaceType == SurfaceType::Plastic ? "plastic" : "matte") << "\"" << std::endl;
        std::cout << "    Ka " << obj.ka << std::endl;
        std::cout << "    Kd " << obj.kd << std::endl;
        std::cout << "    Ks " << obj.ks << std::endl;
        std::cout << "    Specular " << obj.specR << " " << obj.specG << " " << obj.specB << " " << obj.specExp << std::endl;
    }

    // Apply transformations: rotation and scaling
    if (obj.rotX != 0.0f) std::cout << "    Rotate \"X\" " << obj.rotX << std::endl;
    if (obj.rotY != 0.0f) std::cout << "    Rotate \"Y\" " << obj.rotY << std::endl;
    if (obj.rotZ != 0.0f) std::cout << "    Rotate \"Z\" " << obj.rotZ << std::endl;
    
    if (obj.scaleX != 1.0f || obj.scaleY != 1.0f || obj.scaleZ != 1.0f) 
        std::cout << "    Scale " << obj.scaleX << " " << obj.scaleY << " " << obj.scaleZ << std::endl;
    
    // Object-specific rendering based on type
    if (obj.type == ObjectType::SuperquadricSphere) {
        float radius = 1.0f;
        std::cout << "    SqSphere " << radius << " " << obj.northParam << " " << obj.eastParam 
                  << " " << -radius << " " << radius << " 360" << std::endl;
    } else if (obj.type == ObjectType::Torus) {
        std::cout << "    SqTorus " << obj.radius1 << " " << obj.radius2 << " " 
                  << obj.northParam << " " << obj.eastParam << " -180 180 360" << std::endl;
    } else if (obj.type == ObjectType::RegularSphere) {
        std::cout << "    Sphere 1.0 -1.0 1.0 360" << std::endl;
    }
    
    std::cout << "XformPop" << std::endl << std::endl;
}

/**
 * @brief Generate a field of stars with variety
 * 
 * Creates stars of three types:
 * 1. Regular spheres (simple stars)
 * 2. Superquadric stars (with star-like pointy shapes)
 * 3. Light-emitting stars (that act as light sources)
 * 
 * @param numStars Total number of stars to generate
 * @param numSuperQuadricStars Number of superquadric stars
 * @param numLightEmittingStars Number of light-emitting stars
 * @return Vector of generated star objects
 */
std::vector<CelestialObject> generateStarfield(int numStars, int numSuperQuadricStars, int numLightEmittingStars) {
    std::vector<CelestialObject> stars;

    // Generate regular stars - simplified version
    for (int i = 0; i < numStars - numSuperQuadricStars - numLightEmittingStars; i++) {
        CelestialObject star;

        // Generate random positions distributed throughout space
        float phi = randomFloat(0, 2 * M_PI);
        float theta = randomFloat(0, M_PI);
        float radius = randomFloat(8.0f, 15.0f);

        star.x = radius * sin(theta) * cos(phi);
        star.y = radius * sin(theta) * sin(phi);
        star.z = radius * cos(theta);

        // Regular stars are small and white-ish
        star.scaleX = star.scaleY = star.scaleZ = randomFloat(REGULAR_STAR_MIN_SCALE, REGULAR_STAR_MAX_SCALE);
        float brightness = randomFloat(0.7f, 1.0f);
        star.r = brightness;
        star.g = brightness;
        star.b = brightness;

        // Regular stars use regular spheres (not superquadrics)
        star.type = ObjectType::RegularSphere;
        star.surfaceType = SurfaceType::Matte;
        star.ka = 0.8f;
        star.kd = 0.9f;
        star.ks = 0.0f;

        stars.push_back(star);
    }

    // Generate superquadric stars - now with simplified distribution
    for (int i = 0; i < numSuperQuadricStars; i++) {
        CelestialObject star;

        // Generate random positions using spherical distribution
        float phi = randomFloat(0, 2 * M_PI);
        float theta = randomFloat(0, M_PI);
        float radius = randomFloat(7.0f, 13.0f);

        star.x = radius * sin(theta) * cos(phi);
        star.y = radius * sin(theta) * sin(phi);
        star.z = radius * cos(theta);

        // Simplified color scheme - just randomize between color types
        int colorType = i % 3;
        if (colorType == 0) {
            // Blue
            star.r = 0.7f;
            star.g = 0.7f; 
            star.b = 1.0f;
        } else if (colorType == 1) {
            // Red
            star.r = 1.0f;
            star.g = 0.7f;
            star.b = 0.7f;
        } else {
            // Yellow
            star.r = 1.0f;
            star.g = 1.0f;
            star.b = 0.8f;
        }

        // Superquadric parameters - star-like shapes
        star.scaleX = star.scaleY = star.scaleZ = randomFloat(SQ_STAR_MIN_SCALE, SQ_STAR_MAX_SCALE);
        star.northParam = randomFloat(0.2f, 0.5f);  // Values < 1.0 create pointy stars
        star.eastParam = randomFloat(0.2f, 0.5f);
        star.type = ObjectType::SuperquadricSphere;

        // Random rotation
        star.rotX = randomFloat(0.0f, 90.0f);
        star.rotY = randomFloat(0.0f, 90.0f);
        star.rotZ = randomFloat(0.0f, 90.0f);

        // Not emitting light
        star.emitsLight = false;

        stars.push_back(star);
    }

    // Generate just a few light-emitting stars
    for (int i = 0; i < numLightEmittingStars; i++) {
        CelestialObject star;

        // More evenly distribute light stars
        float phi = 2.0f * M_PI * i / numLightEmittingStars;
        float theta = M_PI * (0.3f + 0.4f * randomFloat(0, 1));  // Concentrate in mid-sky
        float radius = 10.0f + randomFloat(-1.0f, 1.0f);

        star.x = radius * sin(theta) * cos(phi);
        star.y = radius * sin(theta) * sin(phi);
        star.z = radius * cos(theta);

        // Simplified light stars - larger and brighter
        star.scaleX = star.scaleY = star.scaleZ = LIGHT_STAR_MAX_SCALE;

        // Alternate colors for light stars
        if (i % 3 == 0) {
            // Blue light
            star.r = 0.6f;
            star.g = 0.6f;
            star.b = 1.0f;
        } else if (i % 3 == 1) {
            // Red light
            star.r = 1.0f; 
            star.g = 0.6f;
            star.b = 0.6f;
        } else {
            // Yellow light
            star.r = 1.0f;
            star.g = 1.0f;
            star.b = 0.8f;
        }
        
        // Fixed light intensity to avoid randomness issues
        star.lightIntensity = 0.3f;
        
        // Rounded superquadric parameters
        star.northParam = 1.0f;
        star.eastParam = 1.0f;
        star.type = ObjectType::SuperquadricSphere;

        // Minimal rotation for light stars
        star.rotX = 0;
        star.rotY = 0; 
        star.rotZ = 0;

        // This star emits light
        star.emitsLight = true;

        stars.push_back(star);
    }

    return stars;
}

/**
 * @brief Output the scene header with display and format settings
 * 
 * @param width Image width in pixels
 * @param height Image height in pixels
 */
void outputSceneHeader(int width = 800, int height = 600) {
    std::cout << "# Superquadrics Demonstration Scene with Star and Sun Lighting" << std::endl;
    std::cout << "Display \"Superquadrics Demo\" \"Screen\" \"rgbdouble\"" << std::endl;
    std::cout << "Format " << width << " " << height << std::endl;
    std::cout << "OptionReal \"Divisions\" 20" << std::endl << std::endl;
}

/**
 * @brief Configure camera settings for the scene
 * 
 * @param eyeX,eyeY,eyeZ Camera position
 * @param atX,atY,atZ Look-at point
 */
void outputCameraSettings(float eyeX = 9, float eyeY = 7, float eyeZ = 12, 
                          float atX = 0, float atY = 1, float atZ = 0) {
    std::cout << "CameraEye " << eyeX << " " << eyeY << " " << eyeZ << std::endl;
    std::cout << "CameraAt " << atX << " " << atY << " " << atZ << std::endl;
    std::cout << "CameraUp 0 1 0" << std::endl;
    std::cout << "CameraFOV 45" << std::endl;
    std::cout << "Clipping 0.1 1000" << std::endl << std::endl;
    
    // Darker space-like background
    std::cout << "Background 0.02 0.02 0.06" << std::endl << std::endl;
}

/**
 * @brief Set up the main light sources for the scene
 */
void setupLighting() {
    // Base ambient light
    std::cout << "# Ambient light for base illumination" << std::endl;
    std::cout << "AmbientLight 0.08 0.08 0.12 0.3" << std::endl << std::endl;
    
    // Special ambient light for the sun
    std::cout << "# Special ambient light to make sun visible" << std::endl;
    std::cout << "AmbientLight 0.3 0.3 0.2 0.5" << std::endl << std::endl;
    
    // Main sun point light
    std::cout << "# Main sun light source at the center" << std::endl;
    std::cout << "PointLight 0 0 0 1.0 1.0 0.7 12.0" << std::endl << std::endl;
}

/**
 * @brief Create all spherical celestial objects for the scene
 * 
 * @return Vector of celestial objects
 */
std::vector<CelestialObject> createCelestialObjects() {
    std::vector<CelestialObject> objects;
    
    // Central sun
    objects.push_back(createSun(12.0f));

    // Inner planet (cube-like)
    objects.push_back(createPlanet(-3, 0, 3, 0.8f, 2.0f, 2.0f, 0.4f, 0.4f, 0.8f));

    // Outer planet (pinched sphere)
    objects.push_back(createPlanet(4, -1, -2, 1.2f, 0.5f, 2.0f, 0.3f, 0.8f, 0.3f));

    // Moon (squashed sphere)
    objects.push_back(createPlanet(5.5f, 0, -3, 0.4f, 2.0f, 0.5f, 0.8f, 0.8f, 0.8f));

    // Asteroid (elongated star-like shape)
    CelestialObject asteroid;
    asteroid.setPosition(-3, -1, -3)
        .setRotation(15, 20, 0)
        .setScale(0.3f, 0.3f, 1.0f)  // Elongated along Z axis
        .setParameters(0.3f, 0.3f)   // Star-like shape
        .setColor(0.7f, 0.6f, 0.5f)  // Brown-gray color
        .setSurface(SurfaceType::Plastic, 0.2f, 0.9f, 0.3f)
        .setSpecular(0.5f, 0.5f, 0.5f, 5);
    objects.push_back(asteroid);
    
    return objects;
}

/**
 * @brief Create all torus objects for the scene
 * 
 * @return Vector of torus objects
 */
std::vector<CelestialObject> createTorusObjects() {
    std::vector<CelestialObject> objects;
    
    // Gear-like planet
    CelestialObject gear;
    gear.setPosition(-4, 2, -3)
        .setRotation(75, 0, 0)
        .setParameters(1.0f, 0.2f)   // Sharp outer edge
        .setColor(0.9f, 0.7f, 0.5f)  // Copper-like color
        .setTorus(0.8f, 0.4f)
        .setSurface(SurfaceType::Plastic, 0.2f, 0.9f, 0.4f)
        .setSpecular(0.6f, 0.6f, 0.6f, 5);
    objects.push_back(gear);
    
    // First orbital ring (blue)
    objects.push_back(createRing(30, 0, 4.0f, 0.1f, 1.0f, 0.2f, 0.5f, 0.5f, 0.8f));
    
    // Second orbital ring (gray)
    objects.push_back(createRing(0, 45, 5.5f, 0.2f, 2.0f, 2.0f, 0.5f, 0.5f, 0.5f));
    
    return objects;
}

/**
 * @brief Parse command line arguments to customize the scene
 * 
 * @param argc Argument count
 * @param argv Argument values
 * @param numStars Total number of stars (output)
 * @param numSuperQuadricStars Number of superquadric stars (output)
 * @param numLightEmittingStars Number of light-emitting stars (output)
 */
void parseCommandLineArgs(int argc, char* argv[], int& numStars, int& numSuperQuadricStars, int& numLightEmittingStars) {
    // Parse command-line arguments with validation
    if (argc > 1) {
        int inputVal = std::atoi(argv[1]);
        if (inputVal > 0) {
            numStars = inputVal;
        } else {
            std::cerr << "Warning: Invalid star count, using default value: " << numStars << std::endl;
        }
    }
    if (argc > 2) {
        int inputVal = std::atoi(argv[2]);
        if (inputVal >= 0 && inputVal <= numStars) {
            numSuperQuadricStars = inputVal;
        } else {
            std::cerr << "Warning: Invalid superquadric star count, using default value: " 
                      << numSuperQuadricStars << std::endl;
        }
    }
    if (argc > 3) {
        int inputVal = std::atoi(argv[3]);
        if (inputVal >= 0 && inputVal <= numStars - numSuperQuadricStars) {
            numLightEmittingStars = inputVal;
        } else {
            std::cerr << "Warning: Invalid light-emitting star count, using default value: " 
                      << numLightEmittingStars << std::endl;
        }
    }

    // Ensure we don't exceed total star count
    if (numSuperQuadricStars + numLightEmittingStars > numStars) {
        int regularStars = numStars - numSuperQuadricStars - numLightEmittingStars;
        if (regularStars < 0) {
            numSuperQuadricStars = numStars / 2;
            numLightEmittingStars = numStars - numSuperQuadricStars;
            std::cerr << "Warning: Adjusted star counts to match total. "
                      << "Superquadric: " << numSuperQuadricStars 
                      << ", Light-emitting: " << numLightEmittingStars << std::endl;
        }
    }
}

/**
 * @brief Render a collection of celestial objects
 * 
 * @param objects Vector of objects to render
 * @param description Optional description comment
 */
void renderObjects(const std::vector<CelestialObject>& objects, const std::string& description = "") {
    if (!description.empty()) {
        std::cout << "# " << description << std::endl;
    }
    for (const auto& obj : objects) {
        renderObject(obj);
    }
}

/**
 * @brief Main function
 * 
 * Processes command-line arguments, generates the scene, and outputs RD commands
 * 
 * @param argc Argument count
 * @param argv Argument values
 * @return Exit status (0 on success)
 */
int main(int argc, char* argv[]) {
    // Default values for scene customization
    int numStars = 40;
    int numSuperQuadricStars = 8;
    int numLightEmittingStars = 5;

    // Parse command-line arguments
    parseCommandLineArgs(argc, argv, numStars, numSuperQuadricStars, numLightEmittingStars);

    // Write scene header
    outputSceneHeader();

    // Adjusted camera position to ensure all objects are visible
    outputCameraSettings();

    // Start the world
    std::cout << "WorldBegin" << std::endl;

    // Setup lighting
    setupLighting();

    // Generate starfield with some superquadric stars and light-emitting stars
    std::vector<CelestialObject> stars = generateStarfield(numStars, numSuperQuadricStars, numLightEmittingStars);

    // Render all stars
    renderObjects(stars, "Generating star field with various star types");

    // Create main celestial objects
    std::vector<CelestialObject> celestialObjects = createCelestialObjects();

    // Create torus objects
    std::vector<CelestialObject> torusObjects = createTorusObjects();

    // Render all sphere objects
    renderObjects(celestialObjects, "Rendering celestial objects");

    // Render all torus objects
    renderObjects(torusObjects, "Rendering torus objects");

    // End the world
    std::cout << "WorldEnd" << std::endl;

    return 0;
}