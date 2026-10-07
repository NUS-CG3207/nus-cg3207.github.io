`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: NUS
// Engineer: Shahzor Ahmad, Rajesh C Panicker
// 
// Create Date: 27.09.2016 16:55:23
// Design Name: 
// Module Name: test_MCycle
// Project Name: 
// Target Devices: 
// Tool Versions: 
// Description: 
// 
// Dependencies: 
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
//////////////////////////////////////////////////////////////////////////////////
/* 
----------------------------------------------------------------------------------
--	(c) Shahzor Ahmad, Rajesh C Panicker
--	License terms :
--	You are free to use this code as long as you
--		(i) DO NOT post it on any public repository;
--		(ii) use it only for educational purposes;
--		(iii) accept that the program is provided "as is" without warranty of any kind or assurance regarding its suitability for any particular purpose;
--		(iv) send an email to rajesh.panicker@ieee.org briefly mentioning its use (except when used for the course CG3207 at the National University of Singapore);
--		(v) retain this notice in this file or any files derived from this.
----------------------------------------------------------------------------------
*/

module test_MCycle(

    );
    
    // DECLARE INPUT SIGNALs
    reg CLK = 0 ;
    reg RESET = 0 ;
    reg Start = 0 ;
    reg [1:0] MCycleOp = 0 ;
    reg [3:0] Operand1 = 0 ;
    reg [3:0] Operand2 = 0 ;

    // DECLARE OUTPUT SIGNALs
    wire [3:0] Result1 ;
    wire [3:0] Result2 ;
    wire Busy ;
    
    // INSTANTIATE DEVICE/UNIT UNDER TEST (DUT/UUT)
    MCycle dut( 
        CLK, 
        RESET, 
        Start, 
        MCycleOp, 
        Operand1, 
        Operand2, 
        Result1, 
        Result2, 
        Busy
        ) ;
    
    // STIMULI
    initial begin
        // hold reset state for 100 ns.
        #10 ;    
        MCycleOp = 2'b00 ;
        Operand1 = 4'b1111 ;
        Operand2 = 4'b1111 ;
        Start = 1'b1 ; // Start is asserted continously(Operations are performed back to back). To try a non-continous Start, you can uncomment the commented lines.    

        wait(Busy) ; // suspend initial block till condition becomes true  ;
        wait(~Busy) ;
//        #10 ;
//        Start = 1'b0 ;
//        #10 ;
        Operand1 = 4'b1110 ;
        Operand2 = 4'b1111 ;
//        Start = 1'b1 ;
        
        wait(Busy) ; 
        wait(~Busy) ;
//        #10 ;
//        Start = 1'b0 ;
//        #10 ;
        MCycleOp = 2'b01 ;
        Operand1 = 4'b1111 ;
        Operand2 = 4'b1111 ;
//        Start = 1'b1 ;

        wait(Busy) ; 
        wait(~Busy) ; 
//        #10 ;
//        Start = 1'b0 ;
//        #10 ;
        Operand1 = 4'b1110 ;
        Operand2 = 4'b1111 ;
//        Start = 1'b1 ;

        wait(Busy) ; 
        wait(~Busy) ; 
        Start = 1'b0 ;
    end
     
    // GENERATE CLOCK       
    always begin 
        #5 CLK = ~CLK ; 
        // invert CLK every 5 time units 
    end
    
endmodule