`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Company: NUS	
-- Engineer: (c) Rajesh Panicker  
-- 
-- Create Date: 09/22/2020 06:49:10 PM
-- Module Name: RegFile
-- Project Name: CG3207 Project
-- Target Devices: Nexys 4 / Basys 3
-- Tool Versions: Vivado 2019.2
-- Description: RISC-V Processor Register File Module
-- 
-- Dependencies: NIL
-- 
-- Revision:
-- Revision 0.01 - File Created
-- Additional Comments: Interface and implementation can be modified.
-- 
----------------------------------------------------------------------------------

----------------------------------------------------------------------------------
--	License terms :
--	You are free to use this code as long as you
--		(i) DO NOT post it on any public repository;
--		(ii) use it only for educational purposes;
--		(iii) accept the responsibility to ensure that your implementation does not violate anyone's intellectual property.
--		(iv) accept that the program is provided "as is" without warranty of any kind or assurance regarding its suitability for any particular purpose;
--		(v) send an email to rajesh<dot>panicker<at>ieee.org briefly mentioning its use (except when used for the course CG3207 at the National University of Singapore);
--		(vi) retain this notice in this file as well as any files derived from this.
----------------------------------------------------------------------------------
*/

module RegFile(
    input CLK,
    input WE,
    input [4:0] rs1,
    input [4:0] rs2,
    input [4:0] rd,
    input [31:0] WD,
    output reg [31:0] RD1,
    output reg [31:0] RD2
    );
    
    // declare RegBank
    reg [31:0] RegBank[0:31] ;
        // 32 addresses, each a 32-bit word
        // (1 to 31) is sufficient as R15 is not stored. Kept it as (0 to 31) just to supress a warning
		
    // read
    always@(*)	// change to @posedge CLK only if using synch read. In that case, the output is RD1E, RD2E directly
    begin
    	RD1 <= (rs1 == 5'b00000) ? 32'd0 : RegBank[rs1] ; 
    	RD2 <= (rs2 == 5'b00000) ? 32'd0 : RegBank[rs2] ;  
    end 
    
    // write
    always@(posedge CLK)
    begin
        if((rd != 5'b00000) & (WE))
            RegBank[rd] <= WD ;
    end
    
endmodule













