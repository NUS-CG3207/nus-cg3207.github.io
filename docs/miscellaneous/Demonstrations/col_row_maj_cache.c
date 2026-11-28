#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define N 3000  // Adjust for your system (2000–5000 gives clear results)

#define REPS 100  // Timed repetitions per traversal; only the average is printed

// Written after every timed run so the compiler cannot delete the traversal
// (without it, -O2 may drop the loop that computes the sum).
static volatile double sink;

// Measure elapsed time in seconds
double elapsed(struct timespec start, struct timespec end) {
    return (end.tv_sec - start.tv_sec) +
           (end.tv_nsec - start.tv_nsec) / 1e9;
}

// Which traversal(s) to run (selected with a command line switch)
enum { MODE_BOTH, MODE_ROW, MODE_COL };

void usage(const char *prog) {
    printf("Usage: %s [options]\n", prog);
    printf("\n");
    printf("  -r, --row            row-major traversal only     (for i { for j })\n");
    printf("  -c, --col            column-major traversal only  (for j { for i })\n");
    printf("  -b, --both           run both traversals (default when no mode switch)\n");
    printf("  -n, --size <N>       matrix dimension (default N = 3000)\n");
    printf("  -h, --help           print this help\n");
    printf("\n");
    printf("A bare number is also accepted as the matrix size, e.g. '%s 2000'.\n", prog);
    printf("\n");
    printf("Examples:\n");
    printf("  %s -r                     # sequential access, cache friendly\n", prog);
    printf("  %s -c                     # stride N access, many cache misses\n", prog);
    printf("  perf stat -e cache-misses,cache-references %s -r\n", prog);
    printf("  perf stat -e cache-misses,cache-references %s -c\n", prog);
}

int main(int argc, char **argv) {
    int mode = MODE_BOTH;
    int n = N;

    // ---- command line: pick the traversal mode and/or the matrix size ----
    for (int a = 1; a < argc; a++) {
        const char *opt = argv[a];

        if (!strcmp(opt, "-r") || !strcmp(opt, "--row") || !strcmp(opt, "--row-major")) {
            mode = MODE_ROW;
        } else if (!strcmp(opt, "-c") || !strcmp(opt, "--col") || !strcmp(opt, "--col-major") ||
                   !strcmp(opt, "--column") || !strcmp(opt, "--column-major")) {
            mode = MODE_COL;
        } else if (!strcmp(opt, "-b") || !strcmp(opt, "--both")) {
            mode = MODE_BOTH;
        } else if (!strcmp(opt, "-n") || !strcmp(opt, "--size")) {
            if (a + 1 >= argc) {
                fprintf(stderr, "error: '%s' needs an argument\n", opt);
                return 1;
            }
            n = atoi(argv[++a]);
        } else if (!strcmp(opt, "-h") || !strcmp(opt, "--help")) {
            usage(argv[0]);
            return 0;
        } else {
            // anything else must be a bare matrix size, e.g. "./col_row_maj_cache 2000"
            char *end = NULL;
            long val = strtol(opt, &end, 10);
            if (end != opt && *end == '\0')
                n = (int)val;
            else {
                fprintf(stderr, "error: unknown option '%s'\n\n", opt);
                usage(argv[0]);
                return 1;
            }
        }
    }

    if (n <= 0) {
        fprintf(stderr, "error: matrix size must be a positive number\n");
        return 1;
    }

    double **A;
    A = malloc(n * sizeof(double *));
    for (int i = 0; i < n; i++) {
        A[i] = malloc(n * sizeof(double));
        for (int j = 0; j < n; j++)
            A[i][j] = (double)(i + j);
    }

    struct timespec start, end;

    // Row-major traversal (only when selected: -r / --row, or no switch at all)
    // Timed REPS times; only the average time is reported.
    if (mode == MODE_ROW || mode == MODE_BOTH) {
        double total = 0.0;
        for (int rep = 0; rep < REPS; rep++) {
            double sum = 0.0;
            clock_gettime(CLOCK_MONOTONIC, &start);
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    sum += A[i][j];
            clock_gettime(CLOCK_MONOTONIC, &end);
            total += elapsed(start, end);
            sink = sum;
        }
        printf("Row-major average time: %.3f sec\n", total / REPS);
    }

    // Column-major traversal (only when selected: -c / --col, or no switch at all)
    // Timed REPS times; only the average time is reported.
    if (mode == MODE_COL || mode == MODE_BOTH) {
        double total = 0.0;
        for (int rep = 0; rep < REPS; rep++) {
            double sum = 0.0;
            clock_gettime(CLOCK_MONOTONIC, &start);
            for (int j = 0; j < n; j++)
                for (int i = 0; i < n; i++)
                    sum += A[i][j];
            clock_gettime(CLOCK_MONOTONIC, &end);
            total += elapsed(start, end);
            sink = sum;
        }
        printf("Column-major average time: %.3f sec\n", total / REPS);
    }

    // Clean up
    for (int i = 0; i < n; i++) free(A[i]);
    free(A);
    return 0;
}

