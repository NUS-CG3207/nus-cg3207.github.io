#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>

#define SIZE 1024

double get_time() {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec + ts.tv_nsec / 1e9;
}

// Naive matrix multiplication (B accessed column-wise - BAD cache locality)
void matmul_naive(const float *A, const float *B, float *C, int N) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0.0f;
            for (int k = 0; k < N; k++) {
                sum += A[i*N + k] * B[k*N + j]; // B access strides by N elements
            }
            C[i*N + j] = sum;
        }
    }
}

// Transpose matrix B first
void transpose(const float *src, float *dst, int N) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            dst[j*N + i] = src[i*N + j];
        }
    }
}

// Optimized matrix multiplication with pre-transposed B
void matmul_transposed(const float *A, const float *B_T, float *C, int N) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0.0f;
            for (int k = 0; k < N; k++) {
                sum += A[i*N + k] * B_T[j*N + k]; // NOW BOTH are sequential access!
            }
            C[i*N + j] = sum;
        }
    }
}

int main() {
    size_t bytes = SIZE * SIZE * sizeof(float);
    float *A = malloc(bytes);
    float *B = malloc(bytes);
    float *B_T = malloc(bytes);
    float *C1 = malloc(bytes);
    float *C2 = malloc(bytes);
    
    // Initialize matrices
    srand(time(NULL));
    for (int i = 0; i < SIZE*SIZE; i++) {
        A[i] = (float)(rand() % 100) / 10.0f;
        B[i] = (float)(rand() % 100) / 10.0f;
    }

    printf("==================================================\n");
    printf("Matrix Multiplication: Pre-Transpose Optimization\n");
    printf("Matrix Size: %d x %d\n", SIZE, SIZE);
    printf("==================================================\n\n");

    // -------------------- NAIVE VERSION --------------------
    printf("1. Naive implementation:\n");
    printf("   - Matrix B accessed in COLUMN order (bad cache locality)\n");
    double start = get_time();
    matmul_naive(A, B, C1, SIZE);
    double time_naive = get_time() - start;
    printf("   Execution Time: %.3f seconds\n\n", time_naive);

    // -------------------- TRANSPOSE + MULTIPLY --------------------
    printf("2. Transpose-optimized implementation:\n");
    printf("   - Pre-transpose matrix B once first\n");
    printf("   - Both matrices now accessed in sequential ROW order\n");
    start = get_time();
    
    transpose(B, B_T, SIZE);
    matmul_transposed(A, B_T, C2, SIZE);
    
    double time_optimized = get_time() - start;
    double time_matmul_only = time_optimized - (get_time() - start);
    
    printf("   Execution Time:       %.3f seconds\n\n", time_optimized);

    // Verify results match
    int ok = 1;
    for (int i = 0; i < SIZE*SIZE; i++) {
        if (abs(C1[i] - C2[i]) > 0.01f) {
            ok = 0;
            break;
        }
    }

    printf("✅ Results match: %s\n\n", ok ? "YES" : "NO");

    // -------------------- FINAL COMPARISON --------------------
    printf("==================================================\n");
    printf("PERFORMANCE SUMMARY:\n");
    printf("Naive:      %.3f sec\n", time_naive);
    printf("Optimized:  %.3f sec\n", time_optimized);
    printf("Speedup:    %.2fx\n\n", time_naive / time_optimized);
    
    printf("Even though we add extra transpose work, the improved cache\n");
    printf("locality in the inner loop gives massive net performance gain!\n");
    printf("==================================================\n");

    free(A); free(B); free(B_T); free(C1); free(C2);
    return 0;
}