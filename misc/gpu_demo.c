#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define CL_TARGET_OPENCL_VERSION 120
#define CL_USE_DEPRECATED_OPENCL_1_2_APIS
#include <CL/cl.h>

#define MATRIX_SIZE 1024
#define VECTOR_SIZE 10000000

// OpenCL kernel for matrix multiplication
const char *matmul_kernel = 
"__kernel void matmul(__global float* A, __global float* B, __global float* C, int N) {\n"
"    int row = get_global_id(0);\n"
"    int col = get_global_id(1);\n"
"    float sum = 0.0f;\n"
"    for(int k = 0; k < N; k++) {\n"
"        sum += A[row * N + k] * B[k * N + col];\n"
"    }\n"
"    C[row * N + col] = sum;\n"
"}\n";

// OpenCL kernel for vector multiplication
const char *vecmul_kernel = 
"__kernel void vecmul(__global float* A, __global float* B, __global float* C) {\n"
"    int i = get_global_id(0);\n"
"    C[i] = A[i] * B[i];\n"
"}\n";

void cpu_matmul(float *A, float *B, float *C, int N) {
    for(int i = 0; i < N; i++) {
        for(int j = 0; j < N; j++) {
            float sum = 0.0f;
            for(int k = 0; k < N; k++) {
                sum += A[i * N + k] * B[k * N + j];
            }
            C[i * N + j] = sum;
        }
    }
}

void cpu_vecmul(float *A, float *B, float *C, int N) {
    for(int i = 0; i < N; i++) {
        C[i] = A[i] * B[i];
    }
}

double get_time_diff(struct timespec start, struct timespec end) {
    return (end.tv_sec - start.tv_sec) + (end.tv_nsec - start.tv_nsec) / 1e9;
}

int main() {
    cl_platform_id platform;
    cl_device_id device;
    cl_context context;
    cl_command_queue queue;
    cl_program program;
    cl_kernel kernel_matmul, kernel_vecmul;
    cl_int err;
    
    printf("=== GPU Acceleration Demo: Matrix Multiplication vs Vector Multiplication ===\n\n");
    
    // Initialize OpenCL
    clGetPlatformIDs(1, &platform, NULL);
    clGetDeviceIDs(platform, CL_DEVICE_TYPE_GPU, 1, &device, NULL);
    context = clCreateContext(NULL, 1, &device, NULL, NULL, &err);
    queue = clCreateCommandQueue(context, device, 0, &err);
    
    // ========== MATRIX MULTIPLICATION ==========
    printf("--- Matrix Multiplication (%dx%d) ---\n", MATRIX_SIZE, MATRIX_SIZE);
    
    size_t matrix_bytes = MATRIX_SIZE * MATRIX_SIZE * sizeof(float);
    float *A_mat = (float*)malloc(matrix_bytes);
    float *B_mat = (float*)malloc(matrix_bytes);
    float *C_mat_cpu = (float*)malloc(matrix_bytes);
    float *C_mat_gpu = (float*)malloc(matrix_bytes);
    
    // Initialize matrices
    for(int i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
        A_mat[i] = (float)(rand() % 100) / 10.0f;
        B_mat[i] = (float)(rand() % 100) / 10.0f;
    }
    
    // CPU matrix multiplication
    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);
    cpu_matmul(A_mat, B_mat, C_mat_cpu, MATRIX_SIZE);
    clock_gettime(CLOCK_MONOTONIC, &end);
    double cpu_matmul_time = get_time_diff(start, end);
    printf("CPU Time: %.4f seconds\n", cpu_matmul_time);
    
    // GPU matrix multiplication
    cl_mem d_A = clCreateBuffer(context, CL_MEM_READ_ONLY, matrix_bytes, NULL, NULL);
    cl_mem d_B = clCreateBuffer(context, CL_MEM_READ_ONLY, matrix_bytes, NULL, NULL);
    cl_mem d_C = clCreateBuffer(context, CL_MEM_WRITE_ONLY, matrix_bytes, NULL, NULL);
    
    clEnqueueWriteBuffer(queue, d_A, CL_TRUE, 0, matrix_bytes, A_mat, 0, NULL, NULL);
    clEnqueueWriteBuffer(queue, d_B, CL_TRUE, 0, matrix_bytes, B_mat, 0, NULL, NULL);
    
    program = clCreateProgramWithSource(context, 1, &matmul_kernel, NULL, &err);
    clBuildProgram(program, 1, &device, NULL, NULL, NULL);
    kernel_matmul = clCreateKernel(program, "matmul", &err);
    
    int matrix_size = MATRIX_SIZE;
    clSetKernelArg(kernel_matmul, 0, sizeof(cl_mem), &d_A);
    clSetKernelArg(kernel_matmul, 1, sizeof(cl_mem), &d_B);
    clSetKernelArg(kernel_matmul, 2, sizeof(cl_mem), &d_C);
    clSetKernelArg(kernel_matmul, 3, sizeof(int), &matrix_size);
    
    size_t global_work_size[2] = {MATRIX_SIZE, MATRIX_SIZE};
    
    clock_gettime(CLOCK_MONOTONIC, &start);
    clEnqueueNDRangeKernel(queue, kernel_matmul, 2, NULL, global_work_size, NULL, 0, NULL, NULL);
    clFinish(queue);
    clock_gettime(CLOCK_MONOTONIC, &end);
    double gpu_matmul_time = get_time_diff(start, end);
    
    clEnqueueReadBuffer(queue, d_C, CL_TRUE, 0, matrix_bytes, C_mat_gpu, 0, NULL, NULL);
    printf("GPU Time: %.4f seconds\n", gpu_matmul_time);
    printf("Speedup: %.2fx\n\n", cpu_matmul_time / gpu_matmul_time);
    
    clReleaseMemObject(d_A);
    clReleaseMemObject(d_B);
    clReleaseMemObject(d_C);
    clReleaseKernel(kernel_matmul);
    clReleaseProgram(program);
    
    // ========== VECTOR MULTIPLICATION ==========
    printf("--- Vector Multiplication (%d elements) ---\n", VECTOR_SIZE);
    
    size_t vector_bytes = VECTOR_SIZE * sizeof(float);
    float *A_vec = (float*)malloc(vector_bytes);
    float *B_vec = (float*)malloc(vector_bytes);
    float *C_vec_cpu = (float*)malloc(vector_bytes);
    float *C_vec_gpu = (float*)malloc(vector_bytes);
    
    // Initialize vectors
    for(int i = 0; i < VECTOR_SIZE; i++) {
        A_vec[i] = (float)(rand() % 100) / 10.0f;
        B_vec[i] = (float)(rand() % 100) / 10.0f;
    }
    
    // CPU vector multiplication
    clock_gettime(CLOCK_MONOTONIC, &start);
    cpu_vecmul(A_vec, B_vec, C_vec_cpu, VECTOR_SIZE);
    clock_gettime(CLOCK_MONOTONIC, &end);
    double cpu_vecmul_time = get_time_diff(start, end);
    printf("CPU Time: %.6f seconds\n", cpu_vecmul_time);
    
    // GPU vector multiplication
    d_A = clCreateBuffer(context, CL_MEM_READ_ONLY, vector_bytes, NULL, NULL);
    d_B = clCreateBuffer(context, CL_MEM_READ_ONLY, vector_bytes, NULL, NULL);
    d_C = clCreateBuffer(context, CL_MEM_WRITE_ONLY, vector_bytes, NULL, NULL);
    
    clEnqueueWriteBuffer(queue, d_A, CL_TRUE, 0, vector_bytes, A_vec, 0, NULL, NULL);
    clEnqueueWriteBuffer(queue, d_B, CL_TRUE, 0, vector_bytes, B_vec, 0, NULL, NULL);
    
    program = clCreateProgramWithSource(context, 1, &vecmul_kernel, NULL, &err);
    clBuildProgram(program, 1, &device, NULL, NULL, NULL);
    kernel_vecmul = clCreateKernel(program, "vecmul", &err);
    
    clSetKernelArg(kernel_vecmul, 0, sizeof(cl_mem), &d_A);
    clSetKernelArg(kernel_vecmul, 1, sizeof(cl_mem), &d_B);
    clSetKernelArg(kernel_vecmul, 2, sizeof(cl_mem), &d_C);
    
    size_t global_work_size_vec = VECTOR_SIZE;
    
    clock_gettime(CLOCK_MONOTONIC, &start);
    clEnqueueNDRangeKernel(queue, kernel_vecmul, 1, NULL, &global_work_size_vec, NULL, 0, NULL, NULL);
    clFinish(queue);
    clock_gettime(CLOCK_MONOTONIC, &end);
    double gpu_vecmul_time = get_time_diff(start, end);
    
    clEnqueueReadBuffer(queue, d_C, CL_TRUE, 0, vector_bytes, C_vec_gpu, 0, NULL, NULL);
    printf("GPU Time: %.6f seconds\n", gpu_vecmul_time);
    printf("Speedup: %.2fx\n\n", cpu_vecmul_time / gpu_vecmul_time);
    
    // ========== COMPARISON ==========
    printf("=== SUMMARY ===\n");
    printf("Matrix Multiplication Speedup: %.2fx\n", cpu_matmul_time / gpu_matmul_time);
    printf("Vector Multiplication Speedup: %.2fx\n", cpu_vecmul_time / gpu_vecmul_time);

    printf("\nMatrix multiplication achieves far higher speedup because it is COMPUTE BOUND (O(N³))\n");
    printf("while elementwise vector operations remain MEMORY BOUND (O(N)) regardless of which arithmetic operator is used.\n");
    
    // Cleanup
    clReleaseMemObject(d_A);
    clReleaseMemObject(d_B);
    clReleaseMemObject(d_C);
    clReleaseKernel(kernel_vecmul);
    clReleaseProgram(program);
    clReleaseCommandQueue(queue);
    clReleaseContext(context);
    
    free(A_mat); free(B_mat); free(C_mat_cpu); free(C_mat_gpu);
    free(A_vec); free(B_vec); free(C_vec_cpu); free(C_vec_gpu);
    
    return 0;
}