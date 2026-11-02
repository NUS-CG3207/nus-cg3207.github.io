/*
 * number_formats.c : four small demos on number representation.
 *
 *   1  IEEE-754 single precision : bit pattern of -9.875f (incl. the %X misuse)
 *   2  Q0.7 fixed point (int8)   : (a + b) - c with 0.1, 0.2, 0.3
 *   3  Q8.8 fixed point (int16)  : multiplication overflow, then the fix
 *
 * Pick one demo at a time so students can predict the output first.
 * The bugs in demos 1 and 3 are intentional.
 *   4  Floating point            : addition is not associative
 *
 * Build : gcc -Wall -o number_formats number_formats.c
 * Run   : ./number_formats        (interactive menu)
 *         ./number_formats 2      (just demo 2)
 *         ./number_formats 1 3    (demos 1 and 3)
 *         ./number_formats all    (every demo)
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

/* Print the low n bits of v, MSB first, with a space every 4 bits. */
static void print_bits(uint32_t v, int n) {
    for (int i = n - 1; i >= 0; i--) {
        putchar(((v >> i) & 1) ? '1' : '0');
        if (i % 4 == 0 && i != 0) putchar(' ');
    }
}

/* Reinterpret the bits of a float without breaking aliasing rules. */
static uint32_t float_bits(float f) {
    uint32_t u;
    memcpy(&u, &f, sizeof u);
    return u;
}

/* ---------------------------------------------------------------- Demo 1 */
static void demo1_float_encoding(void) {
    puts("=== Demo 1: IEEE-754 single precision encoding ===");

    /* Deliberately wrong: %X expects an unsigned int, but a float (promoted
     * to double) is passed. The output is garbage (undefined behaviour). */
    puts("Predict: printf(\"%X\\n\", -9.875f);");
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wformat"
    printf("%X\n", -9.875f);
#pragma GCC diagnostic pop
    puts("(garbage: the value is not converted, the bits are read from the wrong place)\n");

    /* Reinterpret the memory as an int through a pointer cast. */
    float a = -9.875f;
    puts("Predict: printf(\"%X\\n\", *(int*)(&a));   with a = -9.875f");
    printf("%X\n\n", *(int*)(&a));
    /* (strict aliasing technically forbids this; float_bits() uses memcpy) */

    uint32_t u = float_bits(a);

    uint32_t sign = u >> 31;
    uint32_t exp  = (u >> 23) & 0xFF;
    uint32_t man  = u & 0x7FFFFF;

    printf("value    = %f\n", a);
    printf("hex      = 0x%08X\n", u);
    printf("binary   = "); print_bits(u, 32); putchar('\n');
    printf("sign     = %u (%s)\n", sign, sign ? "negative" : "positive");
    printf("exponent = "); print_bits(exp, 8);
    printf(" = %u, unbiased = %d (bias 127)\n", exp, (int)exp - 127);
    printf("mantissa = "); print_bits(man, 23); printf(" (implicit leading 1)\n");
    puts("check    : -9.875 = -1001.111b = -1.001111b x 2^3");
}

/* ---------------------------------------------------------------- Demo 2 */
static void demo2_q07_rounding(void) {
    puts("=== Demo 2: Q0.7 fixed point, scale factor 128 ===");
    int8_t a = (int8_t)(0.1 * 128);
    int8_t b = (int8_t)(0.2 * 128);
    int8_t c = (int8_t)(0.3 * 128);

    /* a + b is computed in int (integer promotion), so no wrap-around here. */
    int result = (a + b) - c;

    printf("a = 0.1*128 = %5.1f -> %4d = 0x%02X = ", 0.1 * 128, a, (uint8_t)a);
    print_bits((uint8_t)a, 8); printf("  represents %.6f\n", a / 128.0);
    printf("b = 0.2*128 = %5.1f -> %4d = 0x%02X = ", 0.2 * 128, b, (uint8_t)b);
    print_bits((uint8_t)b, 8); printf("  represents %.6f\n", b / 128.0);
    printf("c = 0.3*128 = %5.1f -> %4d = 0x%02X = ", 0.3 * 128, c, (uint8_t)c);
    print_bits((uint8_t)c, 8); printf("  represents %.6f\n", c / 128.0);

    printf("(a + b) - c = %d  -> %.6f in real terms\n", result, result / 128.0);
    puts("expected 0.1 + 0.2 - 0.3 = 0, but each cast truncates toward zero,");
    puts("so the errors accumulate and the result is -1 LSB (-1/128).");
}

/* ---------------------------------------------------------------- Demo 3 */
static void demo3_q88_multiply(void) {
    puts("=== Demo 3: Q8.8 fixed point multiplication ===");
    int16_t A = (int16_t)(1.5 * 256);   /* 384 = 0x0180 */
    int16_t B = (int16_t)(1.5 * 256);

    printf("A = B = 1.5 * 256 = %d = 0x%04X\n", A, (uint16_t)A);

    /* Part A: the original, buggy version. The product is stored in 16 bits. */
    puts("\nPart A (as students would write it):");
    puts("  int16_t C_doublyscaled = (A * B);\n  int16_t C = C_doublyscaled >> 8;");
    puts("Predict: what does c print?");
    int16_t C_doublyscaled = (A * B);
    int16_t C = C_doublyscaled >> 8;
    printf("A * B = 147456 = 0x24000 needs 18 bits; int16_t keeps 0x%04X = %d\n",
           (uint16_t)C_doublyscaled, C_doublyscaled);
    printf("a = %.3f, b = %.3f\n", A / 256.0, B / 256.0);
    printf("c = %.3f (expected 2.250, WRONG)\n", C / 256.0);

    /* Part B: the fix. Product of two Q8.8 numbers is Q16.16 (scale 256*256),
     * so it needs a 32-bit intermediate before rescaling to Q8.8. */
    puts("\nPart B (fixed, 32-bit intermediate):");
    int32_t P = (int32_t)A * B;
    int16_t Cok = (int16_t)(P >> 8);
    printf("A * B (Q16.16)  = %d = 0x%08X\n", P, (uint32_t)P);
    printf(">> 8 (Q8.8)     = %d = 0x%04X\n", Cok, (uint16_t)Cok);
    printf("c = %.3f (correct)\n", Cok / 256.0);
}

/* ---------------------------------------------------------------- Demo 4 */
static void demo4_float_associativity(void) {
    puts("=== Demo 4: floating point addition is not associative ===");
    /* volatile stops the compiler from folding the sums at compile time. */
    volatile float a = 1e30f, b = -1e30f, c = 1.0f;
    float bc = b + c;
    float ab = a + b;
    float x = ab + c;
    float y = a + bc;

    printf("a = %g (0x%08X), b = %g (0x%08X), c = %g (0x%08X)\n",
           a, float_bits(a), b, float_bits(b), c, float_bits(c));
    printf("a + b       = %.1f (0x%08X)\n", ab, float_bits(ab));
    printf("b + c       = %.1f (0x%08X)  <- 1.0 is absorbed, 24-bit mantissa\n",
           bc, float_bits(bc));
    printf("(a + b) + c = %.1f\n", x);
    printf("a + (b + c) = %.1f\n", y);
}

/* ------------------------------------------------------------------ Main */
typedef void (*demo_fn)(void);
static const struct { const char *name; demo_fn fn; } demos[] = {
    { "IEEE-754 encoding of -9.875f",        demo1_float_encoding },
    { "Q0.7 fixed point rounding error",     demo2_q07_rounding },
    { "Q8.8 fixed point multiplication",     demo3_q88_multiply },
    { "Float addition is not associative",   demo4_float_associativity },
};
#define NDEMOS ((int)(sizeof demos / sizeof demos[0]))

static void run(int i) { demos[i].fn(); putchar('\n'); }

int main(int argc, char **argv) {
    if (argc > 1) {
        for (int k = 1; k < argc; k++) {
            if (strcmp(argv[k], "all") == 0) {
                for (int i = 0; i < NDEMOS; i++) run(i);
            } else {
                int n = atoi(argv[k]);
                if (n < 1 || n > NDEMOS) {
                    fprintf(stderr, "Unknown demo '%s' (use 1-%d or all)\n", argv[k], NDEMOS);
                    return 1;
                }
                run(n - 1);
            }
        }
        return 0;
    }

    for (;;) {
        puts("Select a demo:");
        for (int i = 0; i < NDEMOS; i++) printf("  %d) %s\n", i + 1, demos[i].name);
        puts("  a) All\n  q) Quit");
        printf("> ");
        char buf[32];
        if (!fgets(buf, sizeof buf, stdin) || buf[0] == 'q') break;
        putchar('\n');
        if (buf[0] == 'a') {
            for (int i = 0; i < NDEMOS; i++) run(i);
        } else {
            int n = atoi(buf);
            if (n >= 1 && n <= NDEMOS) run(n - 1);
            else puts("Invalid choice.\n");
        }
    }
    return 0;
}
