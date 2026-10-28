#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define COUNT 64000000

double get_time() {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec + ts.tv_nsec / 1e9;
}

// =============================================
// ARRAY OF STRUCTURES (AoS) layout
// =============================================
typedef struct {
    float x;
    float y;
    float z;
    float w;
} ParticleAoS;

// =============================================
// STRUCTURE OF ARRAYS (SoA) layout
// =============================================
typedef struct {
    float *x;
    float *y;
    float *z;
    float *w;
} ParticleSoA;


int main() {
    printf("==================================================\n");
    printf("Memory Layout Comparison: AoS vs SoA\n");
    printf("%d elements, 4 components each\n", COUNT);
    printf("==================================================\n\n");

    // --------------------------
    // Allocate AoS
    // --------------------------
    ParticleAoS *aos = malloc(COUNT * sizeof(ParticleAoS));
    
    // --------------------------
    // Allocate SoA
    // --------------------------
    ParticleSoA soa;
    soa.x = malloc(COUNT * sizeof(float));
    soa.y = malloc(COUNT * sizeof(float));
    soa.z = malloc(COUNT * sizeof(float));
    soa.w = malloc(COUNT * sizeof(float));


    // --------------------------
    // Initialize both with same data
    // --------------------------
    for (int i = 0; i < COUNT; i++) {
        float v = i * 0.1f;
        aos[i].x = v;   aos[i].y = v+1;  aos[i].z = v+2;  aos[i].w = v+3;
        soa.x[i] = v;   soa.y[i] = v+1;  soa.z[i] = v+2;  soa.w[i] = v+3;
    }

    double start, end;
    volatile float sum;


    // ==================================================
    // TEST: Summing ONLY the X component (common real world pattern)
    // ==================================================
    printf("TEST: Summing ONLY X component:\n");
    
    // AoS version
    start = get_time();
    sum = 0;
    for (int i = 0; i < COUNT; i++) {
        sum += aos[i].x;
    }
    end = get_time();
    double time_aos = end - start;
    printf("  Array of Structs:  %.3f sec\n", time_aos);

    // SoA version
    start = get_time();
    sum = 0;
    for (int i = 0; i < COUNT; i++) {
        sum += soa.x[i];
    }
    end = get_time();
    double time_soa = end - start;
    printf("  Struct of Arrays:  %.3f sec\n", time_soa);
    printf("  Speedup: %.2fx\n\n", time_aos / time_soa);


    // ==================================================
    // EXPLANATION
    // ==================================================
    printf("==================================================\n");
    printf("MEMORY USAGE EXPLANATION:\n\n");
printf("✅ SoA wins when accessing single components: only needed data is fetched\n");
printf("   When reading X, AoS wastes 75%% of every cache line on unused y/z/w fields\n\n");
printf("❌ AoS can be faster if you need to access ALL components together (x/y/z/w)\n");
    printf("==================================================\n");

    free(aos);
    free(soa.x); free(soa.y); free(soa.z); free(soa.w);
    return 0;
}