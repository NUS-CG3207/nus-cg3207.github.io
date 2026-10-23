;----------------------------------------------------------------------------------
;--	License terms :
;--	You are free to use this code as long as you
;--		(i) DO NOT post it on any public repository;
;--		(ii) use it only for educational purposes;
;--		(iii) accept the responsibility to ensure that your implementation does not violate any intellectual property of ARM Holdings or other entities.
;--		(iv) accept that the program is provided "as is" without warranty of any kind or assurance regarding its suitability for any particular purpose;
;--		(v) send an email to rajesh.panicker@ieee.org briefly mentioning its use (except when used for the course CG3207 at the National University of Singapore);
;--		(vi) retain this notice in this file or any files derived from this.
;----------------------------------------------------------------------------------

	AREA    MYCODE, CODE, READONLY, ALIGN=9 ; 2^9 = 512 bytes (enough space for 128 words). Each section is aligned to an address divisible by 512.
   	  ENTRY
	  
; ------- <code memory (ROM mapped to Instruction Memory) begins>
; Total number of instructions should not exceed 127 (126 excluding the last line 'halt B halt').

		LDR R1, LEDS		; Read the location LEDs to get a pointer to (address of) the LEDs into R1. R1 content will be 0x00000C00 after this step is executed.
		LDR R2, DIPS		; Read the location DIPs to get a pointer to (address of) the DIPs into R2. R2 content will be 0x00000C04 after this step is executed.		

main_loop
		LDR R3, DELAY_VAL	; Read the location DELAY_VAL (tentatively, 4) to get the number of iterations in the delay loop into R3.
		LDR R4, [R2]		; Read the location pointed to by R2 (i.e., DIPs) and get the value into R4.
		STR R4, [R1]		; Write R4 content into the location pointed by R1 (i.e., LEDs). If you get an access violation notification, you haven't applied the MMIO.ini file.
		
delay_loop	
		SUBS R3, R3, #1		; Implement a delay loop. Run the loop by the number of iterations specified in R3. 
		BNE delay_loop		; A delay loop is the equivalent of for(i=0; i<R3; i++){}; - a loop which runs R3 times without doing anything.
		;B main_loop		; Go back to line 18. Uncomment this line if you wish to go back and loop
							; which you might want to do when simulating reading DIPs and writing the value to LEDs continously

		; some random instructions below to illustrate the use of PC as an operand, loads, stores etc - doesn't do anything meaningful. Try them out nevertheless.
		MOV  R1, R15        ; It is interesting to note that R15 is read as PC+8 in ARM7. Here, R1 = PC+8 = 0x1C + 8 = 0x24. Does it make sense to have PC=0x1C? - yes, as this is the 7th instruction.
		LDR  R0, constant1	; 
		STR  R5, variable1  ; PC relative STRs are supported in ARM7 (ARMv3 ISA), unlike LPC1769/ARM Cortex M3 or STM32L4/ARM Cortex M4 (ARMv7M ISA)
		LDR  R5, variable1	; load from a variable only after storing something to it (variables are in RAM - a volatile memory)
		LDR	 R2, variable1_addr	; to get the address of variable1 in R2. 
		; instead of the pseudo-instruction LDR	 R2, =variable1, use LDR R2, variable1_addr	and variable1_addr DCD variable1
		STR  R0, [R2]		; store using address of variable 1 as a pointer. *R2 = R0;
		STR  R0, [R2,#4] 	; *(R2+4) = R0; this will cause an access violation as the simulator will see that there is no memory/variable allocated at 0x00000804. 
							; It will work fine on hardware (i.e., in a real system) though, just that you should be sure that the location that you are writing to is something that is ok to 
							; write to (i.e., there is a real writeable hardware/memory mapped to that location, and you are not accidentally overwriting something else, 
							; and some other part of the code wont accidentally overwrite this (the simulator checks this, real hardware will happily allow you to shoot yourself in the foot).
halt	
		B    halt           ; infinite loop to halt computation. // A program should not "terminate" without an operating system to return control to
							; good idea to keep halt B halt as the last line of your code. Not really necessary if your program loops infinitely though
; ------- <\code memory (ROM mapped to Instruction Memory) ends>

	AREA    CONSTANTS, DATA, READONLY, ALIGN=9 
; ------- <constant memory (ROM mapped to Data Memory) begins>
; All constants should be declared in this section. This section is read only (Only LDR, no STR).
; Total number of constants should not exceed 128 (124 excluding the 4 used for peripheral pointers).
; If a variable is accessed multiple times, it is better to store the address in a register and use it rather than load it repeatedly.

;Peripheral pointers
LEDS
		DCD 0x00000C00		; Address of LEDs. //volatile unsigned int * const LEDS = (unsigned int*)0x00000C00;  
DIPS
		DCD 0x00000C04		; Address of DIP switches. //volatile unsigned int * const DIPS = (unsigned int*)0x00000C04;
PBS
		DCD 0x00000C08		; Address of Push Buttons. Optionally used in Lab 2 and later
CONSOLE
		DCD 0x00000C0C		; Address of UART. Optionally used in Lab 2 and later
CONSOLE_IN_valid
		DCD 0x00000C10		; Address of UART. Optionally used in Lab 2 and later
CONSOLE_OUT_ready
		DCD 0x00000C14		; Address of UART. Optionally used in Lab 2 and later
SEVENSEG
		DCD 0x00000C18		; Address of 7-Segment LEDs. Optionally used in Lab 2 and later

; Rest of the constants should be declared below.
ZERO
		DCD 0x00000000		; constant 0
LSB_MASK
		DCD 0x000000FF		; constant 0xFF
DELAY_VAL
		DCD 0x00000002		; delay time.
variable1_addr
		DCD variable1		; address of variable1. Required since we are avoiding pseudo-instructions // unsigned int * const variable1_addr = &variable1;
constant1
		DCD 0xABCD1234		; // const unsigned int constant1 = 0xABCD1234;
string1   
		DCB  "\r\nWelcome to CG3207..\r\n",0	; // unsigned char string1[] = "Hello World!"; // assembler will issue a warning if the string size is not a multiple of 4, but the warning is safe to ignore
stringptr
		DCD string1			;
		
; ------- <constant memory (ROM mapped to Data Memory) ends>	


	AREA   VARIABLES, DATA, READWRITE, ALIGN=9
; ------- <variable memory (RAM mapped to Data Memory) begins>
; All variables should be declared in this section. This section is read-write.
; Total number of variables should not exceed 128. 
; No initialization possible in this region. In other words, you should write to a location before you can read from it (i.e., write to a location using STR before reading using LDR).

variable1
		DCD 0x00000000		;  // unsigned int variable1;
; ------- <variable memory (RAM mapped to Data Memory) ends>	

		END	
		
;const int* x;         // x is a non-constant pointer to constant data
;int const* x;         // x is a non-constant pointer to constant data 
;int*const x;          // x is a constant pointer to non-constant data
		