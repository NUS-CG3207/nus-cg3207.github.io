#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N (64 * 1024 * 1024)   // ~512 MB for double
#define BLOCK_SIZE 64          // ~512 bytes if double (8 bytes)
                               // ~1 cache line on many systems

static inline double now_sec() {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec * 1e-9;
}

void shuffle(size_t *arr, size_t n) {
    for (size_t i = n - 1; i > 0; --i) {
        size_t j = rand() % (i + 1);
        size_t tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

int main() {
    srand(12345);

    double *A = aligned_alloc(64, N * sizeof(double));
    if (!A) { perror("alloc"); return 1; }
    for (size_t i = 0; i < N; i++) A[i] = (double)i;

    size_t num_blocks = N / BLOCK_SIZE;

    size_t *idx_random            = malloc(N * sizeof(size_t));
    size_t *idx_block_seq_randblk = malloc(N * sizeof(size_t));
    size_t *idx_sequential        = malloc(N * sizeof(size_t));
    size_t *idx_randin_randblk    = malloc(N * sizeof(size_t));
    size_t *idx_randin_stride     = malloc(N * sizeof(size_t));
    size_t *idx_blkseq_stride     = malloc(N * sizeof(size_t));

    size_t *blocks = malloc(num_blocks * sizeof(size_t));
    size_t block = 0;
    size_t stride = 3;   // odd => covers all blocks before repeating
        
    // ----------------------------------------------------------------
    // 1. Perfect sequential
    // ----------------------------------------------------------------
    for (size_t i = 0; i < N; i++) idx_sequential[i] = i;
    
    // ----------------------------------------------------------------
    // 2. Fully random
    // ----------------------------------------------------------------
    for (size_t i = 0; i < N; i++) idx_random[i] = i;
    shuffle(idx_random, N);

    // ----------------------------------------------------------------
    // 3. Block-sequential WITHIN block, but blocks in RANDOM order
    // ----------------------------------------------------------------
    for (size_t b = 0; b < num_blocks; b++) blocks[b] = b;
    shuffle(blocks, num_blocks);

    for (size_t b = 0; b < num_blocks; b++) {
        size_t base = blocks[b] * BLOCK_SIZE;
        for (size_t i = 0; i < BLOCK_SIZE; i++)
            idx_block_seq_randblk[b * BLOCK_SIZE + i] = base + i;
    }

    // ----------------------------------------------------------------
    // 4. Random-within-block, block-random
    // ----------------------------------------------------------------
    for (size_t b = 0; b < num_blocks; b++) blocks[b] = b;
    shuffle(blocks, num_blocks);

    for (size_t b = 0; b < num_blocks; b++) {
        size_t base = blocks[b] * BLOCK_SIZE;
        size_t tmp[BLOCK_SIZE];

        for (size_t i = 0; i < BLOCK_SIZE; i++) tmp[i] = base + i;
        shuffle(tmp, BLOCK_SIZE);

        for (size_t i = 0; i < BLOCK_SIZE; i++)
            idx_randin_randblk[b * BLOCK_SIZE + i] = tmp[i];
    }

    // ----------------------------------------------------------------
    // 5. Block-sequential inside each block, but constant-stride blocks
    // ----------------------------------------------------------------
    block = 0;
    for (size_t b = 0; b < num_blocks; b++) {
        size_t base = block * BLOCK_SIZE;
        for (size_t i = 0; i < BLOCK_SIZE; i++)
            idx_blkseq_stride[b * BLOCK_SIZE + i] = base + i;

        block = (block + stride) % num_blocks;
    }
    
    // ----------------------------------------------------------------
    // 6. Random-in-block, constant-stride block stepping
    // ----------------------------------------------------------------
    block = 0;
    for (size_t b = 0; b < num_blocks; b++) {
        size_t base = block * BLOCK_SIZE;

        size_t tmp[BLOCK_SIZE];
        for (size_t i = 0; i < BLOCK_SIZE; i++) tmp[i] = base + i;
        shuffle(tmp, BLOCK_SIZE);

        for (size_t i = 0; i < BLOCK_SIZE; i++)
            idx_randin_stride[b * BLOCK_SIZE + i] = tmp[i];

        block = (block + stride) % num_blocks;
    }

    // ----------------------------------------------------------------
    // Timings
    // ----------------------------------------------------------------
    double t1, t2, sum = 0;

    // 1
    t1 = now_sec();
    for (size_t i = 0; i < N; i++) sum += A[idx_sequential[i]];
    t2 = now_sec();
    printf("1) Perfect sequential:                             %.3f s\n", t2 - t1);
    
    // 2
    t1 = now_sec();
    for (size_t i = 0; i < N; i++) sum += A[idx_random[i]];
    t2 = now_sec();
    printf("2) Fully random:                                    %.3f s\n", t2 - t1);

    // 3
    t1 = now_sec();
    for (size_t i = 0; i < N; i++) sum += A[idx_block_seq_randblk[i]];
    t2 = now_sec();
    printf("3) Block-seq inside, block-random:                 %.3f s\n", t2 - t1);

    // 4
    t1 = now_sec();
    for (size_t i = 0; i < N; i++) sum += A[idx_randin_randblk[i]];
    t2 = now_sec();
    printf("4) Random-in-block, block-random:                  %.3f s\n", t2 - t1);

    // 5
    t1 = now_sec();
    for (size_t i = 0; i < N; i++) sum += A[idx_blkseq_stride[i]];
    t2 = now_sec();
    printf("5) Block-seq inside, constant-stride blocks:        %.3f s\n", t2 - t1);
    
    // 6
    t1 = now_sec();
    for (size_t i = 0; i < N; i++) sum += A[idx_randin_stride[i]];
    t2 = now_sec();
    printf("6) Random-in-block, constant-stride blocks:         %.3f s\n", t2 - t1);

    printf("Dummy sum: %.2f\n", sum); // so that the above steps do not get optimised away.

    free(A);
    free(idx_random);
    free(idx_block_seq_randblk);
    free(idx_sequential);
    free(idx_randin_randblk);
    free(idx_randin_stride);
    free(idx_blkseq_stride);
    free(blocks);

    return 0;
}

