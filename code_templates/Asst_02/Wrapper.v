`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Company: NUS	
-- Engineer: Rajesh Panicker  
-- 
-- Create Date: 09/22/2020 06:49:10 PM
-- Module Name: Wrapper
-- Project Name: CG3207 Project
-- Target Devices: Nexys 4 / Basys 3
-- Tool Versions: Vivado 2019.2
-- Description: Wrapper for RISC-V processor. Not meant to be synthesized directly.
-- 
-- Dependencies: NIL
-- 
-- Revision:
-- Revision 0.01 - File Created
-- Additional Comments: The interface SHOULD NOT be modified unless you modify TOP.vhd too. The implementation can be modified.
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

//>>>>>>>>>>>> ******* FOR SIMULATION. DO NOT SYNTHESIZE THIS DIRECTLY (This is used as a component in TOP.vhd for Synthesis) ******* <<<<<<<<<<<<

module Wrapper
#(
	parameter N_LEDs_OUT = 8,        // Number of LEDs displaying Result. LED(15 downto 15-N_LEDs_OUT+1). 8 by default
	parameter N_DIPs = 16,           // Number of DIPs. 16 by default
	parameter N_PBs  = 3             // Number of PushButtons. 3 by default
		                             // [2:0] -> BTNL, BTNC, BTNR. Note that BTNU is used as PAUSE and BTND is used as RESET
)
(
	input  [N_DIPs-1:0] DIP, 		// 16-bit DIP switch inputs. Not debounced.
	input  [N_PBs-1:0] PB,  		// 3-bit PB switch inputs. Not debounced.
	output reg [N_LEDs_OUT-1:0] LED_OUT, 	// 8-bit LED[7:0]
	output [6:0] LED_PC, 			// LED[15:9] showing PC[8:2].
	output reg [31:0] SEVENSEGHEX, 		// 32-bit value for 8-digit 7 Seg LED Display. 
	output reg [7:0] UART_TX,           	// 8-bit CONSOLE (UART TX) Output. Character sent to PC/testbench via UART.
						// s/w should check if UART_TX_ready is set before writing to this location esp if your CLK_DIV_BITS is small. No consecutive stores
	input UART_TX_ready,			// A status that it is ok to write to the UART_TX.
		                                // This bit should be set in the testbench to indicate readiness to transmit new character.
	output reg UART_TX_valid,           	// A signal from Wrapper to UART hardware that the processor has written a new data byte to be transmitted.
	input [7:0] UART_RX,                	// 8-bit CONSOLE (UART RX) Input. Character received from PC/testbench via UART.
	                                        // s/w should check if UART_RX_valid flag is set before reading from this location. No consecutive loads
	input  	UART_RX_valid,               	// A status that there is a new data byte waiting to be read from UART_RX.
	                                        // This bit should be set in the testbench to indicate a new character.
	output reg UART_RX_ack,              	// A signal from to UART hardware that the processor has read the newly received data byte.
	                                        // The testbench should clear UART_RX_valid when this is set.
	output reg OLED_Write,			// Indicates that the pixel is to be updated. This could happen when you change row or col or data depending on OLED_CTRL[3:0]
	output reg [6:0] OLED_Col = 7'd0,
	output reg [5:0] OLED_Row = 6'd0,
	output reg [23:0] OLED_Data,		// 24-bit pixel so as to see easily on the display. <5R, 6G, 8B>, each extended to 8 bits left aligned.
	input [31:0] ACCEL_Data,		// Packed <Temp, X, Y, Z> from MSB to LSB. X, Y, Z are in +/-2g range, 8-bit signed.
	input ACCEL_DReady,			// Accelerometer data ready signal. Mostly not necessary unless you are reading at a very high rate.
	input  RESET,				// Active high. Implemented in TOP as not(BTND) or Internal_reset.
	input  CLK				// Divided Clock from TOP, shown on LED[8].
);

// Set the base address according to your memory configuration in RARS. Set the size (Depth bits) appropriately as well.
localparam IROM_BASE = 32'h0040_0000;		// make sure this is the same as the .txt address based on the Memory Configuration set in the assembler/linker 
                                            	// and the PC default value as well as reset value in **ProgramCounter.v** 
localparam DMEM_BASE = 32'h1001_0000;    	// make sure this is the same as the .data address based on the Memory Configuration set in the assembler/linker
localparam MMIO_BASE = 32'hFFFF_0000;
localparam PC_INIT = IROM_BASE;			// PC initialization value - same as IROM_BASE

localparam IROM_DEPTH_BITS = 9;		//9 for 128 words. Change if your program is larger.
localparam DMEM_DEPTH_BITS = 9;		//9 for 128 words. Change if your data (const+variable) is larger, and in C/Assembly to set STACK_INIT appropriately.
localparam MMIO_DEPTH_BITS = 8;

// Memory-mapped peripheral register offsets
localparam UART_RX_VALID_OFF 	= 8'h00; //RO, status bit
localparam UART_RX_OFF 			= 8'h04; //RO
localparam UART_TX_READY_OFF 	= 8'h08; //RO, status bit
localparam UART_TX_OFF 			= 8'h0C; //WO
localparam OLED_COL_OFF 		= 8'h20; //WO
localparam OLED_ROW_OFF 		= 8'h24; //WO
localparam OLED_DATA_OFF 		= 8'h28; //WO
localparam OLED_CTRL_OFF 		= 8'h2C; //WO
localparam ACCEL_DATA_OFF 		= 8'h40; //RO
localparam ACCEL_DREADY_OFF 	= 8'h44; //RO, status bit
localparam LED_OFF 				= 8'h60; //WO
localparam DIP_OFF 				= 8'h64; //RO
localparam PB_OFF  				= 8'h68; //RO
localparam SEVENSEG_OFF 		= 8'h80; //WO
localparam CYCLECOUNT_OFF 		= 8'hA0; //RO
                                      
//----------------------------------------------------------------
// RV signals
//----------------------------------------------------------------
wire[31:0] PC ;
reg [31:0] Instr ;
reg[31:0] ReadData_in ;
wire MemRead ;
wire [3:0] MemWrite_out ;
wire[31:0] ALUResult ;
wire[31:0] WriteData_out ;

wire dec_MMIO_read;	// any MMIO register is being read?
reg dec_DMEM_W = 1'b0;
reg dec_MMIO_read_W = 1'b0;  // delayed versions of the decoded signals for output multiplexing
reg bad_MEM_addr;	// bad data memory address. Can be used as interrupt
wire MemWrite;		// overall MemWrite

//----------------------------------------------------------------
// Address Decode signals
//---------------------------------------------------------------
// 'enable' signals from data memory address decoding
reg 
dec_DMEM					,
dec_UART_RX_VALID			,
dec_UART_RX					,
dec_UART_TX_READY			,
dec_UART_TX					,
dec_OLED_COL				,
dec_OLED_ROW				,
dec_OLED_DATA				,
dec_OLED_CTRL				,
dec_ACCEL_DATA				,
dec_ACCEL_DREADY			,
dec_LED						,
dec_DIP						,
dec_PB						,
dec_SEVENSEG				,
dec_CYCLECOUNT				// Cycle count signal
;

//----------------------------------------------------------------
// Memory declaration
//-----------------------------------------------------------------
reg [31:0] IROM	[0:2**(IROM_DEPTH_BITS-2)-1];	// instruction memory aka IROM
reg [31:0] DMEM	[0:2**(DMEM_DEPTH_BITS-2)-1];	// data (constant + variable) memory.

//----------------------------------------------------------------
// Memory initialisation
//----------------------------------------------------------------
initial begin
// Make sure that the .mem files (hexadecimal text memory dump from RARS - name it with .mem extension) are added to the project as 'Design Sources'. Alternatively, specify the full path.
	// The files start with AA so that it is easier t find in the file open/save dialog box 
// If you checked "Copy sources into project", make sure that subsequent dumps from RARS are to projectName/projectName.srcs/sources_1/imports/orignalSourceFolderName 
	// IMP: "Relaunch Simulation" (top menu broken clock-wise button) may not be enough if you change your .mem file. Do SIMULATION > Run Simulation > Run Behavioural Simulation. 
	// In simulation, check the memory contents under test_Wrapper>dut (Wrapper)> IROM (and other memories) if unsure the correct contents are used.
// If you click Generate Bitstream after updating the .mem file, Vivado does not rerun synthesis using the new file, as it does not know that the file was modified externally. 
	// Rerun the synthesis and then bitstream generation though Vivado says it is up to date. 
	
$readmemh("AA_IROM.mem", IROM);
$readmemh("AA_DMEM.mem", DMEM);
// AA_DMEM.mem will generate a warning of having more than necessary data as the assembler dumps the entire data segment including DMEM and MMIO,
	// This is ok as only the first part of it will be used to initialize DMEM.

end

//----------------------------------------------------------------
// Memory and Peripheral outputs to be multiplexed
//----------------------------------------------------------------
reg [31:0] ReadData_DMEM ;
reg [31:0] ReadData_MMIO ;

//----------------------------------------------------------------
// Data memory address decoding
//----------------------------------------------------------------
always@(*) begin
	dec_DMEM 				<= 1'b0;
	bad_MEM_addr 			<= 1'b0;
	dec_UART_RX_VALID		<= 1'b0;
	dec_UART_RX				<= 1'b0;
	dec_UART_TX_READY		<= 1'b0;
	dec_UART_TX				<= 1'b0;
	dec_OLED_COL			<= 1'b0;
	dec_OLED_ROW			<= 1'b0;
	dec_OLED_DATA			<= 1'b0;
	dec_OLED_CTRL			<= 1'b0;
	dec_ACCEL_DATA			<= 1'b0;
	dec_ACCEL_DREADY		<= 1'b0;
	dec_LED					<= 1'b0;
	dec_DIP					<= 1'b0;
	dec_PB					<= 1'b0;
	dec_SEVENSEG			<= 1'b0;
	dec_CYCLECOUNT			<= 1'b0;

	if(ALUResult[31:DMEM_DEPTH_BITS] == DMEM_BASE[31:DMEM_DEPTH_BITS])
		dec_DMEM <= 1'b1;
	else if (ALUResult[31:MMIO_DEPTH_BITS] == MMIO_BASE[31:MMIO_DEPTH_BITS]) begin
		case (ALUResult[MMIO_DEPTH_BITS-1:2])
			UART_RX_VALID_OFF[MMIO_DEPTH_BITS-1:2]: dec_UART_RX_VALID <= 1'b1;
			UART_RX_OFF[MMIO_DEPTH_BITS-1:2]: dec_UART_RX <= 1'b1;
			UART_TX_READY_OFF[MMIO_DEPTH_BITS-1:2]: dec_UART_TX_READY <= 1'b1;
			UART_TX_OFF[MMIO_DEPTH_BITS-1:2]: dec_UART_TX <= 1'b1;
			OLED_COL_OFF[MMIO_DEPTH_BITS-1:2]: dec_OLED_COL <= 1'b1;
			OLED_ROW_OFF[MMIO_DEPTH_BITS-1:2]: dec_OLED_ROW <= 1'b1;
			OLED_DATA_OFF[MMIO_DEPTH_BITS-1:2]: dec_OLED_DATA <= 1'b1;
			OLED_CTRL_OFF[MMIO_DEPTH_BITS-1:2]: dec_OLED_CTRL <= 1'b1;
			ACCEL_DATA_OFF[MMIO_DEPTH_BITS-1:2]: dec_ACCEL_DATA <= 1'b1;
			ACCEL_DREADY_OFF[MMIO_DEPTH_BITS-1:2]: dec_ACCEL_DREADY <= 1'b1;
			LED_OFF[MMIO_DEPTH_BITS-1:2]: dec_LED <= 1'b1;
			DIP_OFF[MMIO_DEPTH_BITS-1:2]: dec_DIP <= 1'b1;
			PB_OFF[MMIO_DEPTH_BITS-1:2]: dec_PB <= 1'b1;
			SEVENSEG_OFF[MMIO_DEPTH_BITS-1:2]: dec_SEVENSEG <= 1'b1;
			CYCLECOUNT_OFF[MMIO_DEPTH_BITS-1:2]: dec_CYCLECOUNT <= 1'b1;
			default: bad_MEM_addr <= 1'b1;
		endcase
	end
	else 
		bad_MEM_addr <= 1'b1;
end

assign dec_MMIO_read = MemRead || dec_DIP || dec_PB || dec_UART_RX_VALID || dec_UART_RX || dec_UART_TX_READY || dec_UART_TX || dec_CYCLECOUNT || dec_ACCEL_DATA || dec_ACCEL_DREADY ;
assign MemWrite = MemWrite_out[3] || MemWrite_out[2] || MemWrite_out[1] || MemWrite_out[0];

//----------------------------------------------------------------
// Input (into RV) multiplexing
//----------------------------------------------------------------
always@(*) begin
if (dec_DMEM_W)
	ReadData_in <= ReadData_DMEM ; 
else 		// dec_MMIO_read_W
	ReadData_in <= ReadData_MMIO ;
end

//----------------------------------------------------------------
// DMEM write
//----------------------------------------------------------------
localparam NUM_COL = 4;
localparam COL_WIDTH = 8;
integer i;
always@(posedge CLK) begin
	if( MemWrite ) begin
		for(i=0;i<NUM_COL;i=i+1) begin
			if(MemWrite_out[i]) begin
				if( dec_DMEM ) begin
					DMEM[ALUResult[DMEM_DEPTH_BITS-1:2]][i*COL_WIDTH +: COL_WIDTH] <= WriteData_out[i*COL_WIDTH +: COL_WIDTH];
				end		      
			end
		end
	end
    //ReadData_DMEM <= DMEM[ALUResult[DMEM_DEPTH_BITS-1:2]] ; //Uncomment only if only using synch read for memory
end

//----------------------------------------------------------------
// Asych DMEM read - //Uncomment the following block (3 lines) if NOT using synch read for memory
//----------------------------------------------------------------
always@( * ) begin 
    ReadData_DMEM <= DMEM[ALUResult[DMEM_DEPTH_BITS-1:2]] ; // async read
end

//----------------------------------------------------------------
// IROM read
//----------------------------------------------------------------
always@( * ) begin // @posedge CLK only if using synch read for memory
    Instr = ( ( PC[31:IROM_DEPTH_BITS] == IROM_BASE[31:IROM_DEPTH_BITS]) && // To check if address is in the valid range
	     				(PC[1:0] == 2'b00) )? // and is word-aligned - we do not support instruction sizes other than 32.
                 IROM[PC[IROM_DEPTH_BITS-1:2]] : 32'h00000013 ; // If the address is invalid, the instruction fetched is NOP. 
                 						// This can be changed to trigger an exception instead if need be.
end

//----------------------------------------------------------------
// Cycle count read
//----------------------------------------------------------------
reg [31:0] cycle_count = 32'd0; // Max 42 seconds at 100 MHz clock
// extending this to generate interrupts at fixed intervals that are powers of two is very easy.
// extending this to generate interrupts at programmable intervals or intervals that are not powers of two is not difficult either. This will require another 
// counter that reloads/resets itself with each interrupt. This reload/reset value can be made programmable by having an MMIO register for the purpose. 
always@(posedge CLK) begin
    if(RESET)
        cycle_count <= 0 ;
    else
        cycle_count <= cycle_count+1 ;
end

//----------------------------------------------------------------
// MMIO read
//----------------------------------------------------------------
always@(*) begin // @posedge CLK only if using synch read for memory
if (dec_DIP)
	ReadData_MMIO <= { {31-N_DIPs+1{1'b0}}, DIP } ; 
else if (dec_PB)
	ReadData_MMIO <= { {31-N_PBs+1{1'b0}}, PB } ; 
else if (dec_UART_RX && UART_RX_valid)
	ReadData_MMIO <= {24'd0, UART_RX};
else if (dec_UART_RX_VALID)
	ReadData_MMIO <= {31'd0, UART_RX_valid};	
else if (dec_UART_TX_READY)
	ReadData_MMIO <= {31'd0, UART_TX_ready};
else if (dec_CYCLECOUNT)
	ReadData_MMIO <= cycle_count;
else if (dec_ACCEL_DATA)
	ReadData_MMIO <= ACCEL_Data;	
else	// dec_ACCEL_DREADY // the default else to avoid the statement from being incomplete
	ReadData_MMIO <= {31'd0, ACCEL_DReady};
end

//----------------------------------------------------------------
// Delaying the decoded signals for multiplexing (delay only if using synch read for memory)
//----------------------------------------------------------------
always@(*) begin // @posedge CLK only if using synch read for memory
    dec_DMEM_W <= dec_DMEM;
    dec_MMIO_read_W <= dec_MMIO_read;
end

//----------------------------------------------------------------
// SevenSeg write
//----------------------------------------------------------------
integer j;
always@(posedge CLK) begin
	if( MemWrite ) begin
		for(j=0;j<NUM_COL;j=j+1) begin
			if(MemWrite_out[j]) begin
				if (RESET)
					SEVENSEGHEX <= 32'd0;
				else if (dec_SEVENSEG)
					SEVENSEGHEX[j*COL_WIDTH +: COL_WIDTH] <= WriteData_out[j*COL_WIDTH +: COL_WIDTH];		      
			end
		end
	end
end

//----------------------------------------------------------------
// Memory-mapped LED write
//----------------------------------------------------------------
always@(posedge CLK) begin
    if(RESET)
        LED_OUT <= 0 ;
    else if( MemWrite_out[0] && dec_LED ) 
        LED_OUT <= WriteData_out[N_LEDs_OUT-1 : 0] ;
end

//----------------------------------------------------------------
// Memory-mapped OLED write
//----------------------------------------------------------------
reg [7:0] OLED_ctrl_reg = 8'd0;// control register. 
// Lower nibble controlling whether the row or column or mode is varied. Upper nibble controlling the colour mode. 
// [3:0] - 0000: vary_pix_data_mode; 0001: vary_col_mode (x); 0010: vary_row_mode (y); 0100: autoadvance_col (row major); 0101: autoadvance_row (column major)
// [7:4] - 0000: 8-bit colour mode; 0001: 16-bit colour mode; 0010: 24-bit colour mode
reg autoadvance_row = 1'b0; // good idea to initialize it as the assignment inside the always blk below takes effect only in cycle 2.
reg autoadvance_col = 1'b0;
always@(posedge CLK) begin
	OLED_Write <=  1'b0;
	case (OLED_ctrl_reg[3:0]) // mapping OLED_Write direclty to TOP will write at the fast clock rate. Not an issue, but unnecessary writes
		4'b0001: 		//vary_col_mode (x)
			if(MemWrite_out[0] && dec_OLED_COL) begin
				OLED_Write <=  1'b1;
				autoadvance_row <= 1'b0;
				autoadvance_col <= 1'b0;
			end
		4'b0010: 		 //vary_row_mode (y)
			if(MemWrite_out[0] && dec_OLED_ROW) begin
				OLED_Write <=  1'b1; 
				autoadvance_row <= 1'b0;
				autoadvance_col <= 1'b0;
			end
		4'b0100: 		// autoadvance_col (row major)
			begin
				if(MemWrite_out[0] && dec_OLED_DATA) begin
					OLED_Write <= 1'b1;
					autoadvance_row <= 1'b0;
					autoadvance_col <= 1'b1;
					if(autoadvance_col)
						if(OLED_Col>=95) begin // >= as software could write >95
							OLED_Col <= 7'd0; 
							if(OLED_Row==63) OLED_Row <= 6'd0;	// this is redundant, as it will roll over to 0 anyway. Leaving it for comprehensibility, no h/w cost 
							else OLED_Row <= OLED_Row+1;
						end
						else OLED_Col <= OLED_Col+1;
				end
			end
		4'b0101: 		// autoadvance_row (column major)
			begin
				if(MemWrite_out[0] && dec_OLED_DATA) begin
					OLED_Write <= 1'b1;
					autoadvance_row <= 1'b1;
					autoadvance_col <= 1'b0;
     				if(autoadvance_row)
						if(OLED_Row==63) begin
					   		OLED_Row <= 6'd0; 	//redundant
					   		if(OLED_Col>=95) OLED_Col <= 7'd0; 
					   		else OLED_Col <= OLED_Col+1;
					  	end
					   	else OLED_Row <= OLED_Row+1;
				end
			end
		default:
			begin		//vary_pix_data_mode
				if(MemWrite && dec_OLED_DATA) begin
					OLED_Write <=  1'b1; 
					autoadvance_row <= 1'b0;
					autoadvance_col <= 1'b0;
				end
			end
	endcase
        
	case (OLED_ctrl_reg[7:4])
		4'b0001: 		// 16-bit colour mode 5R-6G-5B - can only be written as whole world or lower half-word.
			if( MemWrite_out[1] && MemWrite_out[0] && dec_OLED_DATA )
				OLED_Data <= { WriteData_out[15:11], 3'd0, WriteData_out[10:5], 2'd0, WriteData_out[4:0], 3'd0};
		4'b0010: 
			begin		// 24-bit colour mode -  byte, half-word, and whole word accessible
				if( MemWrite_out[2] && dec_OLED_DATA )
					OLED_Data[23:16] <= WriteData_out[23:16];  
				if( MemWrite_out[1] && dec_OLED_DATA )
					OLED_Data[15:8] <= WriteData_out[15:8];
				if( MemWrite_out[0] && dec_OLED_DATA )
					OLED_Data[7:0] <= WriteData_out[7:0];
			end
		default: 		// 8-bit colour mode 3R-3G-2B (1 byte) - LSB byte, lower half-word, and whole word accessible
			if( MemWrite_out[0] && dec_OLED_DATA )
				OLED_Data <= { WriteData_out[7:5], 5'd0, WriteData_out[4:2], 5'd0, WriteData_out[1:0], 6'd0}; 
	endcase 
	
	if( MemWrite_out[0] && dec_OLED_CTRL )
        OLED_ctrl_reg <= WriteData_out[7:0] ;
	if( MemWrite_out[0] && dec_OLED_ROW ) 
        OLED_Row <= WriteData_out[5:0] ;
	if( MemWrite_out[0] && dec_OLED_COL )
        OLED_Col <= WriteData_out[6:0] ;
           
end


//----------------------------------------------------------------
// UART read / write
//----------------------------------------------------------------
always @(posedge CLK) begin
	UART_TX_valid <= 1'b0;
	UART_RX_ack <= 1'b0;
	if (MemWrite_out[0] && dec_UART_TX && UART_TX_ready)
	begin
		UART_TX <= WriteData_out[7:0];
		UART_TX_valid <= 1'b1;
	end
	if (MemRead && dec_UART_RX && UART_RX_valid)
		UART_RX_ack <= 1'b1;
end

//----------------------------------------------------------------
// Debug LEDs
//----------------------------------------------------------------
assign LED_PC = PC[15-N_LEDs_OUT+1 : 2]; // debug showing PC

//----------------------------------------------------------------
// RV port map
//----------------------------------------------------------------
RV #(.PC_INIT(PC_INIT)) RV1(
	CLK,
	RESET,
	Instr,
	ReadData_in,
	MemRead,
	MemWrite_out,
	PC,
	ALUResult,
	WriteData_out
);

endmodule
