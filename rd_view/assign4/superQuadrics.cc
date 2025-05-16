#define _USE_MATH_DEFINES
#include "cs630.h"
#include <cmath>
#include <iostream>
#include <vector>
#include <cstring>

using namespace render_direct;

/**
 * @brief Creates a superquadric sphere
 * 
 * Generates a parameterized superquadric sphere defined by:
 * x = r * (sgn(cos(theta)) * |cos(theta)|^east) * (sgn(cos(phi)) * |cos(phi)|^north)
 * y = r * (sgn(sin(theta)) * |sin(theta)|^east) * (sgn(cos(phi)) * |cos(phi)|^north)
 * z = r * (sgn(sin(phi)) * |sin(phi)|^north)
 * 
 * @param radius The radius of the sphere
 * @param north The north-south exponent controlling vertical shape
 * @param east The east-west exponent controlling horizontal shape
 * @param zmin Lower z-bound (can create partial spheres)
 * @param zmax Upper z-bound (can create partial spheres)
 * @param thetamax Maximum angle in degrees (can create partial spheres)
 * @return 0 on success, -1 on error
 */
int REDirect::rd_sqsphere(float radius, float north, float east, 
        float zmin, float zmax, float thetamax)
{
    // Enable normal vectors for proper lighting calculations
    obj_normal_flag = true;
    render_m_attr.clear();
    render_m_attr.add_geometry();
    render_m_attr.add_normal();
    render_m_attr.add_shading_offset();

    // Parameter validation
    if (zmin > zmax) {
        std::cerr << "Error: zmin > zmax in sqsphere" << std::endl;
        return -1;
    }
    if (radius <= 0) {
        std::cerr << "Error: radius <= 0 in sqsphere" << std::endl;
        return -1;
    }
    if (thetamax <= 0 || thetamax > 360) {
        std::cerr << "Error: thetamax <= 0 or thetamax > 360 in sqsphere" << std::endl;
        return -1;
    }
    if (zmin == zmax) {
        std::cerr << "Error: zmin == zmax in sqsphere" << std::endl;
        return -1;
    }

    // Clamp zmin and zmax to valid range
    if (zmin < -radius) {
        zmin = -radius;
    }
    if (zmax > radius) {
        zmax = radius;
    }
    
    // Superquadric sphere parametric equations:
    // x = r * (sgn(cos(theta)) * abs(cos(theta))^east) * (sgn(cos(phi)) *abs(cos(phi))^north)
    // y = r * (sgn(sin(theta)) * abs(sin(theta))^east) * (sgn(cos(phi)) *abs(cos(phi))^north)
    // z = r * (sgn(sin(phi)) * abs(sin(phi))^north)
    // Where:
    // -90 <= phi <= 90 (latitude)
    // 0 <= theta < 360 (longitude)

    // Convert zmin/zmax to phi angles for parameter space
    float phimin = asin(zmin/radius) * 180.0 / M_PI;
    float phimax = asin(zmax/radius) * 180.0 / M_PI;

    // Pre-allocate the entire grid to avoid memory issues during evaluation
    std::vector<std::vector<attr_point>> grid(n_divisions+1, std::vector<attr_point>(n_divisions+1));

    // Create the grid of points - evaluate the superquadric surface
    for (int ui = 0; ui <= n_divisions; ui++) {
        // Calculate theta angle (longitude) for this grid point
        float theta = (float)ui / n_divisions * thetamax * M_PI / 180.0;
        float cos_theta = cos(theta);
        float sin_theta = sin(theta);

        for (int vi = 0; vi <= n_divisions; vi++) {
            // Calculate phi angle (latitude) for this grid point
            float phi = phimin + (float)vi / n_divisions * (phimax - phimin);
            phi = phi * M_PI / 180.0;
            float cos_phi = cos(phi);
            float sin_phi = sin(phi);

            // Apply superquadric formulation - preserve sign and apply power
            float sgn_cos_theta = (cos_theta >= 0) ? 1.0f : -1.0f;
            float sgn_sin_theta = (sin_theta >= 0) ? 1.0f : -1.0f;
            float sgn_cos_phi = (cos_phi >= 0) ? 1.0f : -1.0f;
            float sgn_sin_phi = (sin_phi >= 0) ? 1.0f : -1.0f;

            // Calculate the powered terms using sgn(x)|x|^n formula
            float pow_cos_theta = sgn_cos_theta * pow(fabs(cos_theta), east);
            float pow_sin_theta = sgn_sin_theta * pow(fabs(sin_theta), east);
            float pow_cos_phi = sgn_cos_phi * pow(fabs(cos_phi), north);
            float pow_sin_phi = sgn_sin_phi * pow(fabs(sin_phi), north);

            // Calculate 3D coordinates using the superquadric equations
            float x = radius * pow_cos_theta * pow_cos_phi;
            float y = radius * pow_sin_theta * pow_cos_phi;
            float z = radius * pow_sin_phi;

            // Reference to grid point we're calculating
            attr_point& p = grid[ui][vi];
            
            // Initialize all coordinates to zero first for safety
            memset(&p, 0, sizeof(attr_point));
            
            // Set the position and homogeneous coordinate
            p.coord[0] = x;
            p.coord[1] = y;
            p.coord[2] = z;
            p.coord[3] = 1.0f; // Homogeneous coordinate
            p.coord[4] = 1.0f; // Additional coordinate needed by the renderer
        }
    }

    // Compute vertex normals for smooth shading by averaging face normals
    std::vector<std::vector<float>> accumulated_normals(n_divisions + 1, 
                                                    std::vector<float>((n_divisions + 1) * 3, 0.0f));
    std::vector<std::vector<int>> normal_counts(n_divisions + 1, 
                                            std::vector<int>(n_divisions + 1, 0));

    // Calculate face normals and accumulate to vertices for averaging
    for (int ui = 0; ui < n_divisions; ui++) {
        for (int vi = 0; vi < n_divisions; vi++) {
            float v1[3], v2[3], normal[3];

            // Calculate edge vectors for the current quad face
            for (int i = 0; i < 3; i++) {
                v1[i] = grid[ui + 1][vi].coord[i] - grid[ui][vi].coord[i];
                v2[i] = grid[ui][vi + 1].coord[i] - grid[ui][vi].coord[i];
            }

            // Calculate face normal vector using cross product
            normal[0] = v1[1] * v2[2] - v1[2] * v2[1]; // Cross product x component
            normal[1] = v1[2] * v2[0] - v1[0] * v2[2]; // Cross product y component
            normal[2] = v1[0] * v2[1] - v1[1] * v2[0]; // Cross product z component

            // Normalize the face normal
            float length = sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
            if (length > 0.0001f) {
                normal[0] /= length;
                normal[1] /= length;
                normal[2] /= length;
            }

            // Add this face normal to all four corners of the quad for later averaging
            for (int i = 0; i <= 1; i++) {
                for (int j = 0; j <= 1; j++) {
                    accumulated_normals[ui + i][(vi + j) * 3 + 0] += normal[0];
                    accumulated_normals[ui + i][(vi + j) * 3 + 1] += normal[1];
                    accumulated_normals[ui + i][(vi + j) * 3 + 2] += normal[2];
                    normal_counts[ui + i][vi + j]++;
                }
            }
        }
    }

    // Average the normals at each vertex for smooth shading
    for (int ui = 0; ui <= n_divisions; ui++) {
        for (int vi = 0; vi <= n_divisions; vi++) {
            if (normal_counts[ui][vi] > 0) {
                // Compute the average normal
                float nx = accumulated_normals[ui][vi * 3 + 0] / normal_counts[ui][vi];
                float ny = accumulated_normals[ui][vi * 3 + 1] / normal_counts[ui][vi];
                float nz = accumulated_normals[ui][vi * 3 + 2] / normal_counts[ui][vi];

                // Normalize the averaged normal
                float length = sqrt(nx * nx + ny * ny + nz * nz);
                if (length > 0.0001f) {
                    nx /= length;
                    ny /= length;
                    nz /= length;
                }

                // Store normal in the grid point for rendering
                grid[ui][vi].coord[render_m_attr.normal] = nx;
                grid[ui][vi].coord[render_m_attr.normal + 1] = ny;
                grid[ui][vi].coord[render_m_attr.normal + 2] = nz;
            }
        }
    }

    // Render the grid as polygons (quads)
    for (int ui = 0; ui < n_divisions; ui++) {
        for (int vi = 0; vi < n_divisions; vi++) {
            // Calculate polygon normal for flat shading and backface culling
            float v1[3], v2[3];
            for (int i = 0; i < 3; i++) {
                v1[i] = grid[ui + 1][vi].coord[i] - grid[ui][vi].coord[i];
                v2[i] = grid[ui][vi + 1].coord[i] - grid[ui][vi].coord[i];
            }

            // Calculate the face normal using cross product
            poly_normal[0] = v1[1] * v2[2] - v1[2] * v2[1];
            poly_normal[1] = v1[2] * v2[0] - v1[0] * v2[2];
            poly_normal[2] = v1[0] * v2[1] - v1[1] * v2[0];

            // Normalize the normal vector
            float length = sqrt(poly_normal[0] * poly_normal[0] + 
                                poly_normal[1] * poly_normal[1] + 
                                poly_normal[2] * poly_normal[2]);
            if (length > 0.0001f) {
                poly_normal[0] /= length;
                poly_normal[1] /= length;
                poly_normal[2] /= length;
            }

            // Make copies of points to avoid potential memory corruption
            attr_point p00 = grid[ui][vi];       // Bottom-left point
            attr_point p10 = grid[ui+1][vi];     // Bottom-right point
            attr_point p11 = grid[ui+1][vi+1];   // Top-right point
            attr_point p01 = grid[ui][vi+1];     // Top-left point

            // Draw the quad as a polygon - last point has DRAW flag to complete the polygon
            poly_pipeline(p00, MOVE);
            poly_pipeline(p10, MOVE);
            poly_pipeline(p11, MOVE);
            poly_pipeline(p01, DRAW);
        }
    }
    
    return 0;
}

/**
 * @brief Creates a superquadric torus
 * 
 * Generates a parameterized superquadric torus defined by:
 * x = (R + r*cos(phi)^north)*cos(theta)^east
 * y = (R + r*cos(phi)^north)*sin(theta)^east
 * z = r*sin(phi)^north
 * 
 * Where R is the major radius (radius1) and r is the minor radius (radius2)
 * 
 * @param radius1 The major radius of the torus (distance from origin to center of tube)
 * @param radius2 The minor radius of the torus (radius of the tube itself)
 * @param north The north-south exponent controlling tube shape
 * @param east The east-west exponent controlling overall torus shape
 * @param phimin Minimum phi angle in degrees (tube cross-section starting angle)
 * @param phimax Maximum phi angle in degrees (tube cross-section ending angle)
 * @param thetamax Maximum theta angle in degrees (can create partial tori)
 * @return 0 on success, -1 on error
 */
int REDirect::rd_sqtorus(float radius1, float radius2, 
        float north, float east, float phimin, float phimax, 
        float thetamax)
{
    // Enable normal vectors for proper lighting calculations
    obj_normal_flag = true;
    render_m_attr.clear();
    render_m_attr.add_geometry();
    render_m_attr.add_normal();
    render_m_attr.add_shading_offset();

    // Parameter validation
    if (radius1 <= 0 || radius2 <= 0) {
        std::cerr << "Error: radius <= 0 in sqtorus" << std::endl;
        return -1;
    }
    if (thetamax <= 0 || thetamax > 360) {
        std::cerr << "Error: thetamax <= 0 or thetamax > 360 in sqtorus" << std::endl;
        return -1;
    }
    if (phimin >= phimax) {
        std::cerr << "Error: phimin >= phimax in sqtorus" << std::endl;
        return -1;
    }
    // Clamp phi range to valid values
    if (phimin < -180) phimin = -180;
    if (phimax > 180) phimax = 180;

    // Pre-allocate the entire grid to avoid memory issues during evaluation
    std::vector<std::vector<attr_point>> grid(n_divisions+1, std::vector<attr_point>(n_divisions+1));

    // Create the grid of points - evaluate the superquadric torus surface
    for (int ui = 0; ui <= n_divisions; ui++) {
        // Calculate theta angle (circular path around the torus) for this grid point
        float theta = (float)ui / n_divisions * thetamax * M_PI / 180.0;
        float cos_theta = cos(theta);
        float sin_theta = sin(theta);

        // Apply superquadric formulation - preserve sign and apply power for theta
        float sgn_cos_theta = (cos_theta >= 0) ? 1.0f : -1.0f;
        float sgn_sin_theta = (sin_theta >= 0) ? 1.0f : -1.0f;
        float pow_cos_theta = sgn_cos_theta * pow(fabs(cos_theta), east);
        float pow_sin_theta = sgn_sin_theta * pow(fabs(sin_theta), east);

        for (int vi = 0; vi <= n_divisions; vi++) {
            // Calculate phi angle (around the tube) for this grid point
            float phi = phimin + (float)vi / n_divisions * (phimax - phimin);
            phi = phi * M_PI / 180.0;
            float cos_phi = cos(phi);
            float sin_phi = sin(phi);

            // Apply superquadric formulation - preserve sign and apply power for phi
            float sgn_cos_phi = (cos_phi >= 0) ? 1.0f : -1.0f;
            float sgn_sin_phi = (sin_phi >= 0) ? 1.0f : -1.0f;
            float pow_cos_phi = sgn_cos_phi * pow(fabs(cos_phi), north);
            float pow_sin_phi = sgn_sin_phi * pow(fabs(sin_phi), north);

            // Calculate 3D coordinates using superquadric torus equations
            float x = pow_cos_theta * (radius1 + radius2 * pow_cos_phi);
            float y = pow_sin_theta * (radius1 + radius2 * pow_cos_phi);
            float z = radius2 * pow_sin_phi;

            // Reference to grid point we're calculating
            attr_point& p = grid[ui][vi];
            
            // Initialize all coordinates to zero first for safety
            memset(&p, 0, sizeof(attr_point));
            
            // Set the position and homogeneous coordinate
            p.coord[0] = x;
            p.coord[1] = y;
            p.coord[2] = z;
            p.coord[3] = 1.0f; // Homogeneous coordinate
            p.coord[4] = 1.0f; // Additional coordinate needed by the renderer
        }
    }

    // Compute vertex normals for smooth shading by averaging face normals
    std::vector<std::vector<float>> accumulated_normals(n_divisions + 1, 
                                                    std::vector<float>((n_divisions + 1) * 3, 0.0f));
    std::vector<std::vector<int>> normal_counts(n_divisions + 1, 
                                            std::vector<int>(n_divisions + 1, 0));

    // Calculate face normals and accumulate to vertices for averaging
    for (int ui = 0; ui < n_divisions; ui++) {
        for (int vi = 0; vi < n_divisions; vi++) {
            float v1[3], v2[3], normal[3];

            // Calculate edge vectors for the current quad face
            for (int i = 0; i < 3; i++) {
                v1[i] = grid[ui + 1][vi].coord[i] - grid[ui][vi].coord[i];
                v2[i] = grid[ui][vi + 1].coord[i] - grid[ui][vi].coord[i];
            }

            // Calculate face normal vector using cross product
            normal[0] = v1[1] * v2[2] - v1[2] * v2[1]; // Cross product x component
            normal[1] = v1[2] * v2[0] - v1[0] * v2[2]; // Cross product y component
            normal[2] = v1[0] * v2[1] - v1[1] * v2[0]; // Cross product z component

            // Normalize the face normal
            float length = sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
            if (length > 0.0001f) {
                normal[0] /= length;
                normal[1] /= length;
                normal[2] /= length;
            }

            // Add this face normal to all four corners of the quad for later averaging
            for (int i = 0; i <= 1; i++) {
                for (int j = 0; j <= 1; j++) {
                    accumulated_normals[ui + i][(vi + j) * 3 + 0] += normal[0];
                    accumulated_normals[ui + i][(vi + j) * 3 + 1] += normal[1];
                    accumulated_normals[ui + i][(vi + j) * 3 + 2] += normal[2];
                    normal_counts[ui + i][vi + j]++;
                }
            }
        }
    }

    // Average the normals at each vertex for smooth shading
    for (int ui = 0; ui <= n_divisions; ui++) {
        for (int vi = 0; vi <= n_divisions; vi++) {
            if (normal_counts[ui][vi] > 0) {
                // Compute the average normal
                float nx = accumulated_normals[ui][vi * 3 + 0] / normal_counts[ui][vi];
                float ny = accumulated_normals[ui][vi * 3 + 1] / normal_counts[ui][vi];
                float nz = accumulated_normals[ui][vi * 3 + 2] / normal_counts[ui][vi];

                // Normalize the averaged normal
                float length = sqrt(nx * nx + ny * ny + nz * nz);
                if (length > 0.0001f) {
                    nx /= length;
                    ny /= length;
                    nz /= length;
                }

                // Store normal in the grid point for rendering
                grid[ui][vi].coord[render_m_attr.normal] = nx;
                grid[ui][vi].coord[render_m_attr.normal + 1] = ny;
                grid[ui][vi].coord[render_m_attr.normal + 2] = nz;
            }
        }
    }

    // Render the grid as polygons (quads)
    for (int ui = 0; ui < n_divisions; ui++) {
        for (int vi = 0; vi < n_divisions; vi++) {
            // Calculate polygon normal for flat shading and backface culling
            float v1[3], v2[3];
            for (int i = 0; i < 3; i++) {
                v1[i] = grid[ui + 1][vi].coord[i] - grid[ui][vi].coord[i];
                v2[i] = grid[ui][vi + 1].coord[i] - grid[ui][vi].coord[i];
            }

            // Calculate the face normal using cross product
            poly_normal[0] = v1[1] * v2[2] - v1[2] * v2[1];
            poly_normal[1] = v1[2] * v2[0] - v1[0] * v2[2];
            poly_normal[2] = v1[0] * v2[1] - v1[1] * v2[0];

            // Normalize the normal vector
            float length = sqrt(poly_normal[0] * poly_normal[0] + 
                                poly_normal[1] * poly_normal[1] + 
                                poly_normal[2] * poly_normal[2]);
            if (length > 0.0001f) {
                poly_normal[0] /= length;
                poly_normal[1] /= length;
                poly_normal[2] /= length;
            }

            // Make copies of points to avoid potential memory corruption
            attr_point p00 = grid[ui][vi];       // Bottom-left point
            attr_point p10 = grid[ui+1][vi];     // Bottom-right point
            attr_point p11 = grid[ui+1][vi+1];   // Top-right point
            attr_point p01 = grid[ui][vi+1];     // Top-left point

            // Draw the quad as a polygon - last point has DRAW flag to complete the polygon
            poly_pipeline(p00, MOVE);
            poly_pipeline(p10, MOVE);
            poly_pipeline(p11, MOVE);
            poly_pipeline(p01, DRAW);
        }
    }

    return 0;
}