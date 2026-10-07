/* Thanks https://github.com/darklife/darkriscv */
/*   __heap_size    = 0x200;  /* required amount of heap */
/*   __stack_size  = 0x800;  /* required amount of stack */

MEMORY
{
    /* ROM (rwx) : ORIGIN = 0x00000000, LENGTH = 0x10000*/
    /* RAM (rwx) : ORIGIN = 0x00000000, LENGTH = 0xf0010000 */
    IROM (r) : ORIGIN = 0x00400000, LENGTH = 0x10000
    DRAM (rwx) : ORIGIN = 0x10010000, LENGTH = 0x10000
}

SECTIONS
{
    .text 0x00400000:
    {
      *(.text)
      *(.rodata*)
    } > IROM
    .data 0x10010000:
    {
      *(.data)
      *(.bss)
    } > DRAM
}
                        