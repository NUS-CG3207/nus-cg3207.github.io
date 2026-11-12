//////////////////////////////////////////////////////////////////////////////////
// This module is to generate an enable signal for different display frequency based on pushbuttons
// Fill in the blank to complete this module 
// (c) Gu Jing, ECE, NUS
//////////////////////////////////////////////////////////////////////////////////

module Clock_Enable(
	input clk,			// fundamental clock 100 MHz
	input btnU,			// button BTNU for 4Hz speed
	input btnC,			// button BTNC for pause
	output reg enable);	// output signal used to enable the reading of next memory data

// define reg threshold to allow 4hz or 1hz frequency


// define reg counter to be able to count to certain threshold value



initial
begin
	counter = 0;
end
	
	
// complete this always block by determining the enable output by counter, threshold and buttons 
always @(posedge clk)
begin
	
	
	
	
	
	
	
	
	
	
end
	
endmodule
