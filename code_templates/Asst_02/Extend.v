`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Company: NUS	
-- Engineer: (c) Rajesh Panicker  
-- 
-- Create Date: 09/22/2020 06:49:10 PM
-- Module Name: Extend
-- Project Name: CG3207 Project
-- Target Devices: Nexys 4 / Basys 3
-- Tool Versions: Vivado 2019.2
-- Description: RISC-V Processor Immediate Extend Module
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

module Extend(
    input [2:0] ImmSrc, 
    input [31:7] InstrImm, //maintaining the numbering in the instruction for comprehensibility
    output reg [31:0] ExtImm
    );
    
    // ImmSrc pattern chosen (not optimally) such that single bit changes for more similar immediates, which can simplify the logic.
    // For example, SB and S are very similar, so they are assigned 110 and 111 respectively.
    
    always@(ImmSrc, InstrImm)
        case(ImmSrc)
            3'b000: ExtImm = {InstrImm[31:12], 12'h000} ;  // U type
            3'b010: ExtImm = {{12{InstrImm[31]}}, InstrImm[19:12], InstrImm[20], InstrImm[30:21], 1'b0} ;   // UJ   
            3'b011: ExtImm = {{20{InstrImm[31]}}, InstrImm[31:20]} ;  // I    
            3'b110: ExtImm = {{20{InstrImm[31]}}, InstrImm[31:25], InstrImm[11:7]} ;  // S    
            3'b111: ExtImm = {{20{InstrImm[31]}}, InstrImm[7], InstrImm[30:25], InstrImm[11:8], 1'b0} ;  // SB    
            default: ExtImm = 32'bx ;  // undefined     
        endcase   
    
endmodule

/*
case(ImmSrc)
    3'b000: ExtImm <= {    InstrImm[31:20],InstrImm[19:12], 12'h000} ;  // U type
    3'b010: ExtImm <= {{12{InstrImm[31]}}, InstrImm[19:12], InstrImm[20], InstrImm[30:25], InstrImm[24:21], 1'b0} ;   		// UJ   
    3'b011: ExtImm <= {{20{InstrImm[31]}}, InstrImm[31],                  InstrImm[30:25], InstrImm[24:21], InstrImm[20]} ; // I    
    3'b110: ExtImm <= {{20{InstrImm[31]}}, InstrImm[31],                  InstrImm[30:25], InstrImm[11:8], InstrImm[7]} ;  	// S    
    3'b111: ExtImm <= {{20{InstrImm[31]}}, InstrImm[7],                   InstrImm[30:25], InstrImm[11:8], 1'b0} ;  		// SB    
    default: ExtImm <= 32'bx ;  // undefined     
endcase   
*/
