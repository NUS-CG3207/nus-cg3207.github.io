`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// This module should contain the corresponding Memory data generated from Hex2ROM
// and choose the memory data to be displayed based on enable signal  
// Fill in the blank to complete this module 
// (c) Gu Jing, ECE, NUS
//////////////////////////////////////////////////////////////////////////////////


module Get_MEM(
    input clk,					// fundamental clock 100MHz
	input enable,				// enable signal to read the next content
	output [31:0] data,			// 32 bits memory contents for 7-segments display
    output upper_lower);      	// 1-bit signal rerequied for LEDs, indicating which half of the Memory data is displaying on LEDs
								// upper_lower = 1 to display upper half of the Memory data on LEDs
    
// declare IROM and DMEM
reg [31:0] IROM [0:127];
reg [31:0] DMEM [0:127];

// declare indics of IROM and DMEM
reg [8:0] addr;

initial
begin
	////////////////////////////////////////////////////////////////
    // Instruction Memory
    ////////////////////////////////////////////////////////////////
	
	
	// Load the instruction memory from the memory file "IROM.mem"

	////////////////////////////////////////////////////////////////
    // Data Memory
    ////////////////////////////////////////////////////////////////	

	// Load the data memory from the memory file "DMEM.mem"
	    

end

// determine upper_lower by corresponding input

// determine corresponding memory data that should be displayed on 7-segments


// determine memory index "addr" accordingly
always @(posedge clk) // Note : Do NOT replace clk with enable. If you do so, enable is no longer an enable but a clock, and then you are using a clock divider (entire circuit doesnt run on the same clock).
			// Please see towards the end of Lab 1 manual for more info/hints on how to use enable
begin


end
	
endmodule
