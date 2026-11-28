#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <omp.h>

#define ALIGN 64

static inline double now_sec() {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec * 1e-9;
}

// Standard matrix multiplication
void matmul_standard(float* A, float* B, float* C, int N) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0.0f;
            for (int k = 0; k < N; k++) {
                sum += A[i * N + k] * B[k * N + j];  // Poor locality for B
            }
            C[i * N + j] = sum;
        }
    }
}

// Matrix multiplication with transposed B
void matmul_transpose_B(float* A, float* B, float* C, int N) {
    // Transpose B
    float* B_T = aligned_alloc(ALIGN, N * N * sizeof(float));
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            B_T[j * N + i] = B[i * N + j];
        }
    }
    
    // Multiply with good locality for both matrices
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0.0f;
            for (int k = 0; k < N; k++) {
                sum += A[i * N + k] * B_T[j * N + k];  // Both sequential!
            }
            C[i * N + j] = sum;
        }
    }
    
    free(B_T);
}

// Blocked matrix multiplication
void matmul_blocked(float* A, float* B, float* C, int N, int block_size) {
    memset(C, 0, N * N * sizeof(float));
    
    for (int ii = 0; ii < N; ii += block_size) {
        for (int jj = 0; jj < N; jj += block_size) {
            for (int kk = 0; kk < N; kk += block_size) {
                
                int i_end = (ii + block_size < N) ? ii + block_size : N;
                int j_end = (jj + block_size < N) ? jj + block_size : N;
                int k_end = (kk + block_size < N) ? kk + block_size : N;
                
                for (int i = ii; i < i_end; i++) {
                    for (int j = jj; j < j_end; j++) {
                        float sum = C[i * N + j];
                        for (int k = kk; k < k_end; k++) {
                            sum += A[i * N + k] * B[k * N + j];
                        }
                        C[i * N + j] = sum;
                    }
                }
            }
        }
    }
}

// OpenMP parallel matrix multiplication
void matmul_parallel(float* A, float* B, float* C, int N) {
    #pragma omp parallel for
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0.0f;
            for (int k = 0; k < N; k++) {
                sum += A[i * N + k] * B[k * N + j];
            }
            C[i * N + j] = sum;
        }
    }
}

// SMT-aware: Parallel with transposed B and blocking
void matmul_smt_aware(float* A, float* B, float* C, int N) {
    int block_size = 64;  // Tune based on cache size
    
    // Transpose B in parallel
    float* B_T = aligned_alloc(ALIGN, N * N * sizeof(float));
    #pragma omp parallel for
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            B_T[j * N + i] = B[i * N + j];
        }
    }
    
    memset(C, 0, N * N * sizeof(float));
    
    // Blocked multiplication in parallel
    #pragma omp parallel for collapse(2)
    for (int ii = 0; ii < N; ii += block_size) {
        for (int jj = 0; jj < N; jj += block_size) {
            for (int kk = 0; kk < N; kk += block_size) {
                
                int i_end = (ii + block_size < N) ? ii + block_size : N;
                int j_end = (jj + block_size < N) ? jj + block_size : N;
                int k_end = (kk + block_size < N) ? kk + block_size : N;
                
                for (int i = ii; i < i_end; i++) {
                    for (int j = jj; j < j_end; j++) {
                        float sum = 0.0f;
                        for (int k = kk; k < k_end; k++) {
                            sum += A[i * N + k] * B_T[j * N + k];
                        }
                        #pragma omp atomic
                        C[i * N + j] += sum;
                    }
                }
            }
        }
    }
    
    free(B_T);
}

// NUMA-aware and SMT-optimized version
void matmul_numa_smt_aware(float* A, float* B, float* C, int N) {
    int block_size = 128;
    int num_threads = omp_get_max_threads();
    
    float* B_T = aligned_alloc(ALIGN, N * N * sizeof(float));
    
    // Parallel transpose with better work distribution
    #pragma omp parallel for schedule(static)
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            B_T[j * N + i] = B[i * N + j];
        }
    }
    
    memset(C, 0, N * N * sizeof(float));
    
    // Use dynamic scheduling for better load balancing
    #pragma omp parallel for schedule(dynamic, 1) collapse(2)
    for (int ii = 0; ii < N; ii += block_size) {
        for (int jj = 0; jj < N; jj += block_size) {
            for (int kk = 0; kk < N; kk += block_size) {
                
                int i_end = (ii + block_size < N) ? ii + block_size : N;
                int j_end = (jj + block_size < N) ? jj + block_size : N;
                int k_end = (kk + block_size < N) ? kk + block_size : N;
                
                // Local accumulation to avoid false sharing
                for (int i = ii; i < i_end; i++) {
                    for (int j = jj; j < j_end; j++) {
                        float sum = C[i * N + j];
                        for (int k = kk; k < k_end; k++) {
                            sum += A[i * N + k] * B_T[j * N + k];
                        }
                        C[i * N + j] = sum;
                    }
                }
            }
        }
    }
    
    free(B_T);
}

void init_matrix(float* mat, int N, float value) {
    for (int i = 0; i < N * N; i++) {
        mat[i] = value + (float)(rand() % 100) / 100.0f;
    }
}

int main() {
    int N = 1024;  // Adjust size as needed
    printf("Matrix size: %d x %d\n", N, N);
    printf("Threads available: %d\n\n", omp_get_max_threads());
    
    // Allocate matrices
    float* A = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* B = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* C1 = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* C2 = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* C3 = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* C4 = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* C5 = aligned_alloc(ALIGN, N * N * sizeof(float));
    float* C6 = aligned_alloc(ALIGN, N * N * sizeof(float));
    
    // Initialize matrices
    srand(12345);
    init_matrix(A, N, 1.0f);
    init_matrix(B, N, 2.0f);
    
    double t1, t2;
    
    // 1. Standard multiplication
    printf("1. Standard matrix multiplication:\n");
    t1 = now_sec();
    matmul_standard(A, B, C1, N);
    t2 = now_sec();
    printf("   Time: %.4f seconds\n\n", t2 - t1);
    
    // 2. Transposed B multiplication
    printf("2. Matrix multiplication with transposed B:\n");
    t1 = now_sec();
    matmul_transpose_B(A, B, C2, N);
    t2 = now_sec();
    printf("   Time: %.4f seconds\n\n", t2 - t1);
    
    // 3. Blocked multiplication
    printf("3. Blocked matrix multiplication:\n");
    t1 = now_sec();
    matmul_blocked(A, B, C3, N, 64);
    t2 = now_sec();
    printf("   Time: %.4f seconds\n\n", t2 - t1);
    
    // 4. Parallel multiplication
    printf("4. OpenMP parallel multiplication:\n");
    t1 = now_sec();
    matmul_parallel(A, B, C4, N);
    t2 = now_sec();
    printf("   Time: %.4f seconds\n\n", t2 - t1);
    
    // 5. SMT-aware multiplication
    printf("5. SMT-aware multiplication (parallel + transposed + blocked):\n");
    t1 = now_sec();
    matmul_smt_aware(A, B, C5, N);
    t2 = now_sec();
    printf("   Time: %.4f seconds\n\n", t2 - t1);
    
    // 6. NUMA + SMT aware
    printf("6. NUMA + SMT aware multiplication:\n");
    t1 = now_sec();
    matmul_numa_smt_aware(A, B, C6, N);
    t2 = now_sec();
    printf("   Time: %.4f seconds\n\n", t2 - t1);
    
    // Verify results (check first few elements)
    printf("Verification (first element of each result):\n");
    printf("Standard: %.2f, Transposed: %.2f, Blocked: %.2f\n", 
           C1[0], C2[0], C3[0]);
    printf("Parallel: %.2f, SMT-aware: %.2f, NUMA-SMT: %.2f\n", 
           C4[0], C5[0], C6[0]);
    
    // Calculate speedups
    double base_time = t2 - t1;  // Use the last measured time as reference
    printf("\nSpeedup analysis will vary based on your system architecture.\n");
    
    free(A); free(B); 
    free(C1); free(C2); free(C3); free(C4); free(C5); free(C6);
    
    return 0;
}
