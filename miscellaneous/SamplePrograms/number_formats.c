/*
 * number_formats.c : four short predict-observe-explain demos on number
 * representation. For each demo, write down your prediction, press Enter,
 * then compare with what the program prints and explain any difference.
 *
 * Build : gcc -o number_formats number_formats.c
 * Run   : ./number_formats        (all demos)
 *         ./number_formats 2      (just demo 2)
 */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

static void wait_for_enter(void) {
    printf("  [press Enter to see the result] ");
    fflush(stdout);
    while (getchar() != '\n' && !feof(stdin)) { }
}

/* Demo 1: what is actually stored in a float? */
static void demo1(void) {
    puts("=== Demo 1: the bits inside a float ===");
    union { float f; uint32_t u; } x;
    x.f = -9.875f;

    puts("float x = -9.875f;");
    puts("Predict: what is x in hex if we read its 32 bits as an integer?");
    wait_for_enter();
    printf("  x = %f, bits = 0x%08X\n", x.f, x.u);
    puts("Explain: how does 0xC11E0000 relate to -9.875?");
}

/* Demo 2: fixed point with 7 fractional bits */
static void demo2(void) {
    puts("=== Demo 2: 8-bit fixed point (value = integer / 128) ===");
    int8_t a = (int8_t)(0.1 * 128);
    int8_t b = (int8_t)(0.2 * 128);
    int8_t c = (int8_t)(0.3 * 128);

    puts("a = 0.1*128, b = 0.2*128, c = 0.3*128   (stored as int8_t)");
    puts("Predict: what is (a + b) - c ?");
    wait_for_enter();
    printf("  a = %d, b = %d, c = %d\n", a, b, c);
    printf("  (a + b) - c = %d, which means %f\n", (a + b) - c, ((a + b) - c) / 128.0);
    puts("Explain: why is it not 0?");
}

/* Demo 3: fixed point multiplication */
static void demo3(void) {
    puts("=== Demo 3: 16-bit fixed point multiply (value = integer / 256) ===");
    int16_t A = (int16_t)(1.5 * 256);
    int16_t B = (int16_t)(1.5 * 256);

    puts("int16_t A = 1.5*256, B = 1.5*256;");
    puts("int16_t P = A * B;   int16_t C = P >> 8;");
    puts("Predict: what real value does C represent?");
    wait_for_enter();
    int16_t P = A * B;
    int16_t C = P >> 8;
    printf("  C = %d, which means %f\n", C, C / 256.0);
    puts("Explain: 1.5 * 1.5 = 2.25. What went wrong, and how would you fix it?");
}

/* Demo 4: float addition order */
static void demo4(void) {
    puts("=== Demo 4: does the order of float additions matter? ===");
    volatile float a = 1e30f, b = -1e30f, c = 1.0f;   /* volatile: stop compile-time folding */

    puts("float a = 1e30, b = -1e30, c = 1;");
    puts("Predict: (a + b) + c  and  a + (b + c)");
    wait_for_enter();
    float x = (a + b) + c;
    float y = a + (b + c);
    printf("  (a + b) + c = %g\n", x);
    printf("  a + (b + c) = %g\n", y);
    puts("Explain: why are they different?");
}

static void (*demos[])(void) = { demo1, demo2, demo3, demo4 };
#define NDEMOS 4

int main(int argc, char **argv) {
    if (argc > 1) {
        int n = atoi(argv[1]);
        if (n < 1 || n > NDEMOS) {
            fprintf(stderr, "Usage: %s [1-%d]\n", argv[0], NDEMOS);
            return 1;
        }
        demos[n - 1]();
        return 0;
    }
    for (int i = 0; i < NDEMOS; i++) {
        demos[i]();
        putchar('\n');
    }
    return 0;
}
