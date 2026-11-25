`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- CG3207 reference processor core - PRE-SYNTHESISED, NOT SOURCE
--
-- Generated from the reference RTL by Yosys: one flattened module, all internal
-- names discarded. It is here so that HDL simulation mode has something to run
-- before your own processor does, and so that you have something to compare
-- against. It is not a model to copy, and reading it will teach you nothing
-- about how the processor is organised - that is the point.
--
-- What it is: RV32I plus the M extension (mul, mulh, mulhsu, mulhu, div, divu,
-- rem, remu), single cycle except for M, which stalls the PC for 32 or 64
-- cycles. Same ports as RV.v, so the fixed Wrapper.v instantiates it unchanged.
--
-- The register file is deliberately left as a module with its 32 x 32-bit array
-- intact, so the simulator can still show you the registers.
--
-- PC_INIT is fixed at 0x00400000. The parameter is still on the port list so
-- that Wrapper.v binds, but a different value will not elaborate - the generate
-- below then instantiates a module that does not exist, and the tool says so by
-- name rather than quietly running from the wrong address.
--
-- Regenerate with examples/hdl/build_reference_core.sh
----------------------------------------------------------------------------------
--	MIT License
--
--	Copyright (c) 2020 Rajesh Panicker
--
--	Permission is hereby granted, free of charge, to any person obtaining a copy
--	of this software and associated documentation files (the "Software"), to deal
--	in the Software without restriction, including without limitation the rights
--	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
--	copies of the Software, and to permit persons to whom the Software is
--	furnished to do so, subject to the following conditions:
--
--	The above copyright notice and this permission notice shall be included in all
--	copies or substantial portions of the Software.
--
--	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
--	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
--	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
--	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
--	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
--	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
--	SOFTWARE.
--
--	Not a condition of the license, but if you find this code useful, an email to
--	rajesh.panicker <at> u.nus.edu briefly mentioning its use would be appreciated.
----------------------------------------------------------------------------------
*/


module RV #(parameter PC_INIT = 32'h00400000) (CLK, RESET, Instr, ReadData_in, MemRead, MemWrite_out, PC, ALUResult, WriteData_out);
  output [31:0] ALUResult;
  wire [31:0] ALUResult;
  input CLK;
  wire CLK;
  input [31:0] Instr;
  wire [31:0] Instr;
  output MemRead;
  wire MemRead;
  output [3:0] MemWrite_out;
  wire [3:0] MemWrite_out;
  output [31:0] PC;
  reg [31:0] PC = 32'd4194304;
  input RESET;
  wire RESET;
  input [31:0] ReadData_in;
  wire [31:0] ReadData_in;
  output [31:0] WriteData_out;
  wire [31:0] WriteData_out;
  wire [3:0] _0_;
  wire [1:0] _100_;
  wire [1:0] _101_;
  wire [31:0] _102_;
  wire [31:0] _103_;
  wire [15:0] _104_;
  wire [7:0] _105_;
  wire [7:0] _106_;
  wire [7:0] _107_;
  wire [7:0] _108_;
  wire [23:0] _109_;
  wire _10_;
  wire [3:0] _110_;
  wire [31:0] _111_;
  wire [32:0] _112_;
  wire [31:0] _113_;
  wire [31:0] _114_;
  wire [31:0] _115_;
  wire _116_;
  wire _117_;
  wire _118_;
  wire _119_;
  wire _11_;
  wire _120_;
  wire _121_;
  wire _122_;
  wire _123_;
  wire _124_;
  wire _125_;
  wire _126_;
  wire [31:0] _127_;
  wire _128_;
  wire _129_;
  wire [31:0] _12_;
  wire _130_;
  wire _131_;
  wire [31:0] _132_;
  wire [31:0] _133_;
  wire [31:0] _134_;
  wire _135_;
  wire _136_;
  wire _137_;
  wire _138_;
  wire _139_;
  wire [31:0] _13_;
  wire _140_;
  wire _141_;
  wire _142_;
  wire _143_;
  wire _144_;
  wire _145_;
  wire _146_;
  wire _147_;
  wire _148_;
  wire _149_;
  wire _14_;
  wire [7:0] _150_;
  wire [63:0] _151_;
  wire [63:0] _152_;
  wire [63:0] _153_;
  wire _154_;
  wire [31:0] _155_;
  wire [31:0] _156_;
  wire _157_;
  wire _158_;
  wire _159_;
  wire [3:0] _15_;
  wire [63:0] _160_;
  wire [63:0] _161_;
  wire [7:0] _162_;
  wire _163_;
  wire [63:0] _164_;
  wire _165_;
  wire _166_;
  wire [63:0] _167_;
  wire [63:0] _168_;
  wire [63:0] _169_;
  wire [2:0] _16_;
  wire _170_;
  wire [63:0] _171_;
  wire [31:0] _172_;
  wire [31:0] _173_;
  wire [63:0] _174_;
  wire [31:0] _175_;
  wire [31:0] _176_;
  wire [31:0] _177_;
  wire _178_;
  wire _179_;
  wire _17_;
  wire _180_;
  wire _181_;
  wire _182_;
  wire _183_;
  wire [31:0] _184_;
  wire _185_;
  wire [31:0] _186_;
  wire [31:0] _187_;
  wire _188_;
  wire _189_;
  wire [32:0] _18_;
  wire _190_;
  wire [63:0] _191_;
  wire [31:0] _192_;
  wire [31:0] _193_;
  wire [31:0] _194_;
  wire [31:0] _195_;
  wire _196_;
  wire _197_;
  wire _198_;
  wire _199_;
  wire [31:0] _19_;
  wire [7:0] _1_;
  wire _200_;
  wire _201_;
  wire _202_;
  wire _203_;
  wire _204_;
  wire _205_;
  wire _206_;
  wire _207_;
  wire _208_;
  wire _209_;
  wire [31:0] _20_;
  wire _210_;
  wire _211_;
  wire _212_;
  wire _213_;
  wire _214_;
  wire _215_;
  wire [31:0] _21_;
  wire [32:0] _22_;
  wire _23_;
  wire [1:0] _24_;
  wire [1:0] _25_;
  wire [31:0] _26_;
  wire _27_;
  wire [2:0] _28_;
  wire _29_;
  wire [31:0] _2_;
  wire _30_;
  wire [2:0] _31_;
  wire _32_;
  wire [1:0] _33_;
  wire _34_;
  wire [31:0] _35_;
  wire _36_;
  reg [31:0] _37_;
  reg [31:0] _38_;
  reg [7:0] _39_ = 8'h00;
  wire [3:0] _3_;
  reg _40_ = 1'h0;
  wire [7:0] _41_;
  wire _42_;
  wire _43_;
  wire _44_;
  wire [63:0] _45_;
  wire [63:0] _46_;
  wire [63:0] _47_;
  reg _48_ = 1'h0;
  reg _49_ = 1'h0;
  wire [23:0] _4_;
  wire _50_;
  wire _51_;
  reg [63:0] _52_ = 64'h0000000000000000;
  reg [63:0] _53_ = 64'h0000000000000000;
  reg _54_ = 1'h0;
  reg [63:0] _55_ = 64'h0000000000000000;
  wire [31:0] _56_;
  wire [1:0] _57_;
  wire [31:0] _58_;
  wire _59_;
  wire [31:0] _5_;
  wire [31:0] _60_;
  wire [31:0] _61_;
  wire [31:0] _62_;
  wire _63_;
  wire _64_;
  wire _65_;
  wire _66_;
  wire _67_;
  wire _68_;
  wire _69_;
  wire [15:0] _6_;
  wire _70_;
  wire _71_;
  wire _72_;
  wire _73_;
  wire _74_;
  wire _75_;
  wire [31:0] _76_;
  wire [31:0] _77_;
  wire [31:0] _78_;
  wire [31:0] _79_;
  wire [15:0] _7_;
  wire [31:0] _80_;
  wire [31:0] _81_;
  wire [31:0] _82_;
  wire [3:0] _83_;
  wire [3:0] _84_;
  wire [2:0] _85_;
  wire [2:0] _86_;
  wire [1:0] _87_;
  wire [1:0] _88_;
  wire [1:0] _89_;
  wire [31:0] _8_;
  wire [1:0] _90_;
  wire [30:0] _91_;
  wire [30:0] _92_;
  wire [30:0] _93_;
  wire _94_;
  wire _95_;
  wire _96_;
  wire _97_;
  wire _98_;
  wire _99_;
  wire _9_;
  RegFile RegFile1 (
    .CLK(CLK),
    .RD1(_60_),
    .RD2({ _61_[31:16], _5_[15:8], WriteData_out[7:0] }),
    .WD(_13_),
    .WE(_14_),
    .rd(Instr[11:7]),
    .rs1(Instr[19:15]),
    .rs2(Instr[24:20])
  );
  assign _12_ = _111_ + { Instr[31], _35_[30:0] };
  assign _29_ = _139_ & _140_;
  assign _135_ = Instr[13] & Instr[12];
  assign _136_ = | { _143_, _89_[0] };
  assign _137_ = | { _144_, _145_, _32_, MemRead, _142_ };
  assign _34_ = | { _144_, _145_, MemRead, _139_, _142_, _143_, _89_[0] };
  assign _88_[1] = | { _145_, _143_, _89_[0] };
  assign _85_[0] = | { MemRead, _142_, _89_[0] };
  assign _138_ = Instr[14:12] == 3'h5;
  assign _140_ = Instr[31:25] == 7'h01;
  assign _141_ = Instr[13] | Instr[12];
  assign _65_ = _122_ | _121_;
  assign _144_ = Instr[6:0] == 7'h37;
  assign _145_ = Instr[6:0] == 7'h17;
  assign _142_ = Instr[6:0] == 7'h13;
  assign _139_ = Instr[6:0] == 7'h33;
  assign _90_[0] = Instr[6:0] == 7'h63;
  assign _32_ = Instr[6:0] == 7'h23;
  assign MemRead = Instr[6:0] == 7'h03;
  assign _89_[0] = Instr[6:0] == 7'h67;
  assign _143_ = Instr[6:0] == 7'h6f;
  assign _27_ = _138_ & Instr[30];
  assign _66_ = _130_ | _129_;
  assign _31_[1] = Instr[14] ? Instr[12] : _135_;
  assign _31_[0] = Instr[14] ? Instr[12] : Instr[13];
  assign _30_ = Instr[14] ? Instr[13] : _141_;
  assign _146_ = _28_ == 3'h7;
  assign _147_ = _28_ == 3'h6;
  assign _148_ = _28_ == 3'h3;
  assign _149_ = _28_ == 3'h2;
  assign _172_ = _184_ + 1'h1;
  assign _173_ = _114_ + 1'h1;
  assign _174_ = _153_ + _151_;
  assign _67_ = _142_ | _90_[0];
  assign { _175_[31:8], _162_ } = _150_ + 32'd1;
  assign _176_ = _186_ + 1'h1;
  assign _177_ = _187_ + 1'h1;
  assign _178_ = _36_ & _182_;
  assign _179_ = _196_ & _190_;
  assign _180_ = _31_[0] & _166_;
  assign _181_ = _185_ & _183_;
  assign _50_ = _188_ & _19_[31];
  assign _51_ = _185_ & _21_[31];
  always @(posedge CLK)
    if (_36_) _38_ <= _156_;
  assign _68_ = _143_ | _85_[0];
  always @(posedge CLK)
    if (_36_) _37_ <= _155_;
  assign _183_ = _150_ == 8'h3f;
  assign _166_ = _150_ == 8'h1f;
  assign _170_ = { _153_[62:0], _151_[31] } >= _152_;
  assign _184_ = ~ _19_;
  assign _185_ = ~ _31_[0];
  assign _186_ = ~ { _151_[30:0], _170_ };
  assign _187_ = ~ _171_[31:0];
  assign _188_ = ~ _31_[1];
  assign _189_ = RESET | _178_;
  assign _69_ = _137_ | _136_;
  assign _163_ = _180_ | _181_;
  always @(posedge CLK)
    _54_ <= _36_;
  always @(posedge CLK)
    _40_ <= _42_;
  always @(posedge CLK)
    _39_ <= _41_;
  always @(posedge CLK)
    _55_ <= _47_;
  always @(posedge CLK)
    _52_ <= _45_;
  always @(posedge CLK)
    _53_ <= _46_;
  always @(posedge CLK)
    _48_ <= _43_;
  always @(posedge CLK)
    _49_ <= _44_;
  assign _171_ = _170_ ? _191_ : { _153_[62:0], _151_[31] };
  assign _70_ = _144_ | _88_[1];
  assign _167_[0] = Instr[14] & _170_;
  assign _169_ = _152_[0] ? _174_ : _153_;
  assign _155_ = Instr[14] ? _194_ : _169_[31:0];
  assign _156_ = Instr[14] ? _195_ : _169_[63:32];
  assign _157_ = Instr[14] ? _166_ : _163_;
  assign _168_ = Instr[14] ? _152_ : { 1'h0, _152_[63:1] };
  assign _164_ = Instr[14] ? _171_ : _169_;
  assign _46_ = _36_ ? _168_ : _152_;
  assign _45_ = _36_ ? { _151_[62:0], _167_[0] } : _151_;
  assign _47_ = _36_ ? _164_ : _153_;
  assign _71_ = _143_ | _89_[0];
  assign _42_ = _36_ & _157_;
  assign _41_ = _36_ ? _162_ : _150_;
  assign { _161_[63], _161_[31:0] } = Instr[14] ? { 1'h0, _193_ } : { _51_, _21_ };
  assign { _160_[63], _160_[31:0] } = Instr[14] ? { 1'h0, _192_ } : { _50_, _19_ };
  assign _159_ = Instr[14] & _50_;
  assign _158_ = Instr[14] & _179_;
  assign _44_ = _189_ ? _159_ : _49_;
  assign _43_ = _189_ ? _158_ : _48_;
  assign _152_ = _189_ ? { _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[31:0] } : _53_;
  assign _151_ = _189_ ? { _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[31:0] } : _52_;
  assign _72_ = _147_ | _146_;
  assign _153_ = _189_ ? 64'h0000000000000000 : _55_;
  assign _150_ = _189_ ? 8'h00 : _39_;
  assign _165_ = ~ _40_;
  assign _182_ = ~ _54_;
  assign _154_ = _54_ ? _165_ : _29_;
  assign _36_ = RESET ? 1'h0 : _154_;
  assign _190_ = | _21_;
  assign _191_ = { _153_[62:0], _151_[31] } - _152_;
  assign _192_ = _50_ ? _172_ : _19_;
  assign _193_ = _51_ ? _173_ : _21_;
  assign _73_ = _201_ | _200_;
  assign _194_ = _43_ ? _176_ : { _151_[30:0], _170_ };
  assign _195_ = _44_ ? _177_ : _171_[31:0];
  assign _196_ = _50_ ^ _51_;
  assign _197_ = ~ _16_[1];
  assign _198_ = Instr[14:12] == 3'h7;
  assign _199_ = Instr[14:12] == 3'h6;
  assign _200_ = Instr[14:12] == 3'h4;
  assign _201_ = Instr[14:12] == 3'h1;
  assign _202_ = ! Instr[14:12];
  assign _100_[1] = _33_ == 2'h3;
  assign _74_ = _204_ | _100_[1];
  assign _8_[31:2] = PC[31:2] + 30'h00000001;
  assign _204_ = _33_ == 2'h2;
  assign _203_ = _33_ == 2'h1;
  assign _58_ = _11_ ? _12_ : { _8_[31:2], PC[1:0] };
  assign _205_ = _57_ == 2'h3;
  assign _206_ = _57_ == 2'h1;
  assign _207_ = _24_ == 2'h3;
  assign _208_ = _24_ == 2'h1;
  assign _209_ = _25_ == 2'h3;
  assign _210_ = _25_ == 2'h1;
  assign _6_ = ALUResult[1] ? ReadData_in[31:16] : ReadData_in[15:0];
  assign _75_ = _214_ | _213_;
  assign _7_[15] = Instr[14] ? 1'h0 : ReadData_in[15];
  assign _4_[23] = Instr[14] ? 1'h0 : ReadData_in[7];
  assign _3_[1] = ALUResult[1] ? 1'h0 : _32_;
  assign _5_[31:16] = ALUResult[1] ? { _5_[15:8], WriteData_out[7:0] } : _61_[31:16];
  assign _3_[3] = ALUResult[1] & _32_;
  assign _211_ = Instr[13:12] == 2'h1;
  assign _2_[23:16] = _213_ ? WriteData_out[7:0] : _61_[23:16];
  assign _2_[15:8] = _214_ ? WriteData_out[7:0] : _5_[15:8];
  assign _0_[1] = _214_ & _32_;
  assign _0_[2] = _213_ & _32_;
  assign _63_ = | { _120_, _119_, _118_, _117_, _116_ };
  assign _2_[31:24] = _10_ ? _61_[31:24] : WriteData_out[7:0];
  assign _213_ = ALUResult[1:0] == 2'h2;
  assign _214_ = ALUResult[1:0] == 2'h1;
  assign _212_ = ! Instr[13:12];
  assign _0_[0] = _215_ & _32_;
  assign _215_ = ! ALUResult[1:0];
  assign _0_[3] = _10_ ? 1'h0 : _32_;
  assign _56_ = _30_ ? _38_ : _37_;
  assign _26_ = _29_ ? _56_ : ALUResult;
  assign _13_ = MemRead ? _62_ : _26_;
  assign _64_ = | { _198_, _199_, _138_ };
  assign _76_ = _117_ ? { 31'h00000000, _16_[1] } : _20_;
  assign _77_ = _116_ ? { 31'h00000000, _16_[0] } : _76_;
  assign _78_ = _121_ ? _113_ : _115_;
  assign _79_ = _123_ ? _127_ : _18_[31:0];
  assign _80_ = _65_ ? _78_ : _79_;
  assign ALUResult = _63_ ? _77_ : _80_;
  assign _81_ = _129_ ? _134_ : _133_;
  assign _14_ = _34_ & _59_;
  assign _82_ = _131_ ? _132_ : _19_;
  assign _20_ = _66_ ? _81_ : _82_;
  assign _83_ = _90_[0] ? 4'h1 : { Instr[14:12], _27_ };
  assign _84_ = _139_ ? { Instr[14:12], Instr[30] } : 4'h0;
  assign _15_ = _67_ ? _83_ : _84_;
  assign { _86_[2], _86_[0] } = _90_[0] ? 2'h3 : { _32_, 1'h0 };
  assign _28_ = _68_ ? { 2'h1, _85_[0] } : { _86_[2], _86_[2], _86_[0] };
  assign _87_[1] = ~ _136_;
  assign _25_ = _69_ ? { _87_[1], 1'h1 } : 2'h0;
  assign _24_ = _70_ ? { _88_[1], 1'h1 } : 2'h0;
  always @(posedge CLK)
    if (RESET) PC[1:0] <= 2'h0;
    else if (_9_) PC[1:0] <= _12_[1:0];
  assign _33_ = _71_ ? { 1'h1, _89_[0] } : { 1'h0, _90_[0] };
  assign { _91_[11], _91_[0] } = _146_ ? { Instr[7], 1'h0 } : { Instr[31], Instr[7] };
  assign { _92_[30:20], _92_[11:1] } = _149_ ? { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[20], Instr[30:21] } : { Instr[30:20], 11'h000 };
  assign _93_ = _148_ ? { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31:20] } : { _92_[30:20], Instr[19:12], _92_[11:1], 1'h0 };
  assign _35_[30:0] = _72_ ? { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], _91_[11], Instr[30:25], Instr[11:8], _91_[0] } : _93_;
  assign _94_ = _199_ ? _16_[0] : _197_;
  assign _95_ = _198_ ? _18_[32] : _94_;
  assign _96_ = _200_ ? _16_[1] : _125_;
  assign _97_ = _202_ & _16_[2];
  assign _98_ = _73_ ? _96_ : _97_;
  always @(posedge CLK)
    if (RESET) PC[31:2] <= 30'h00100000;
    else if (!_36_) PC[31:2] <= _58_[31:2];
  assign _99_ = _64_ ? _95_ : _98_;
  assign _101_[0] = _203_ & _99_;
  assign _57_ = _74_ ? { _100_[1], 1'h1 } : { 1'h0, _101_[0] };
  assign _102_ = _208_ ? 32'd0 : _60_;
  assign _19_ = _207_ ? PC : _102_;
  assign _103_ = _210_ ? 32'd4 : { _61_[31:16], _5_[15:8], WriteData_out[7:0] };
  assign _21_ = _209_ ? { Instr[31], _35_[30:0] } : _103_;
  assign _104_ = _212_ ? { _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23] } : ReadData_in[31:16];
  assign _62_[31:16] = _211_ ? { _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15] } : _104_;
  assign _105_ = _212_ ? { _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23] } : ReadData_in[15:8];
  assign _59_ = ~ _36_;
  assign _62_[15:8] = _211_ ? _6_[15:8] : _105_;
  assign _106_ = _212_ ? _1_ : ReadData_in[7:0];
  assign _62_[7:0] = _211_ ? _6_[7:0] : _106_;
  assign _107_ = _213_ ? ReadData_in[23:16] : ReadData_in[15:8];
  assign _108_ = _215_ ? ReadData_in[7:0] : ReadData_in[31:24];
  assign _1_ = _75_ ? _107_ : _108_;
  assign _109_ = _212_ ? _2_[31:8] : { _61_[31:16], _5_[15:8] };
  assign WriteData_out[31:8] = _211_ ? _5_[31:8] : _109_;
  assign _110_ = _212_ ? _0_ : { _32_, _32_, _32_, _32_ };
  assign MemWrite_out = _211_ ? { _3_[3], _3_[3], _3_[1], _3_[1] } : _110_;
  assign _9_ = & { _11_, _59_ };
  assign _112_ = { 1'h0, _19_ } + { 1'h0, _22_[31:0] };
  assign _18_ = _112_ + { 32'h00000000, _17_ };
  assign _113_ = _19_ & _21_;
  assign _23_ = _128_ & _126_;
  assign _16_[2] = ! _125_;
  assign _114_ = ~ _21_;
  assign _16_[0] = ~ _18_[32];
  assign _115_ = _19_ | _21_;
  assign _118_ = _15_ == 4'hb;
  assign _119_ = _15_ == 4'ha;
  assign _11_ = | { _206_, _205_ };
  assign _120_ = _15_ == 4'h2;
  assign _121_ = _15_ == 4'he;
  assign _122_ = _15_ == 4'hc;
  assign _123_ = _15_ == 4'h8;
  assign _22_[31:0] = _17_ ? _114_ : _21_;
  assign _17_ = | { _117_, _116_, _124_ };
  assign _124_ = _15_ == 4'h1;
  assign _117_ = _15_ == 4'h4;
  assign _116_ = _15_ == 4'h6;
  assign _125_ = | _18_[31:0];
  assign _111_ = _205_ ? _60_ : PC;
  assign _126_ = _21_[31] ~^ _18_[31];
  assign _127_ = _19_ ^ _21_;
  assign _128_ = _19_[31] ^ _21_[31];
  assign _16_[1] = _18_[31] ^ _23_;
  assign _129_ = { _15_[3], _15_[0] } == 2'h3;
  assign _130_ = { _15_[3], _15_[0] } == 2'h2;
  assign _131_ = ! { _15_[3], _15_[0] };
  assign _132_ = _19_ << _21_[4:0];
  assign _133_ = _19_ >> _21_[4:0];
  assign _134_ = $signed(_19_) >>> _21_[4:0];
  assign _10_ = | { _215_, _214_, _213_ };
  assign _2_[7:0] = WriteData_out[7:0];
  assign { _3_[2], _3_[0] } = { _3_[3], _3_[1] };
  assign _4_[22:0] = { _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23], _4_[23] };
  assign _5_[7:0] = WriteData_out[7:0];
  assign _7_[14:0] = { _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15], _7_[15] };
  assign _8_[1:0] = PC[1:0];
  assign _85_[2:1] = 2'h1;
  assign _86_[1] = _86_[2];
  assign _87_[0] = 1'h1;
  assign _88_[0] = 1'h1;
  assign _89_[1] = 1'h1;
  assign _90_[1] = 1'h0;
  assign { _91_[30:12], _91_[10:1] } = { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31:25], Instr[11:8] };
  assign { _92_[19:12], _92_[0] } = { Instr[19:12], 1'h0 };
  assign _100_[0] = 1'h1;
  assign _101_[1] = 1'h0;
  assign _160_[62:32] = { _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63], _160_[63] };
  assign _161_[62:32] = { _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63], _161_[63] };
  assign _167_[63:1] = _151_[62:0];
  assign _175_[7:0] = _162_;
  assign _22_[32] = 1'h0;
  assign _31_[2] = Instr[14];
  assign _35_[31] = Instr[31];
  assign _61_[15:0] = { _5_[15:8], WriteData_out[7:0] };
  generate
    if (PC_INIT != 32'h00400000) begin : pc_init_check
      this_pre_synthesised_core_only_supports_PC_INIT_00400000 u_error();
    end
  endgenerate
endmodule

module RegFile(CLK, WE, rs1, rs2, rd, WD, RD1, RD2);
  wire [31:0] _00_;
  wire _01_;
  wire _02_;
  wire [31:0] _03_;
  wire [31:0] _04_;
  wire _05_;
  input CLK;
  wire CLK;
  output [31:0] RD1;
  wire [31:0] RD1;
  output [31:0] RD2;
  wire [31:0] RD2;
  input [31:0] WD;
  wire [31:0] WD;
  input WE;
  wire WE;
  input [4:0] rd;
  wire [4:0] rd;
  input [4:0] rs1;
  wire [4:0] rs1;
  input [4:0] rs2;
  wire [4:0] rs2;
  reg [31:0] RegBank [31:0];
  always @(posedge CLK) begin
    if (_00_[31])
      RegBank[rd] <= WD;
  end
  assign _04_ = RegBank[rs2];
  assign _03_ = RegBank[rs1];
  assign _00_[31] = _05_ & WE;
  assign _01_ = ! rs1;
  assign _02_ = ! rs2;
  assign _05_ = | rd;
  assign RD1 = _01_ ? 32'd0 : _03_;
  assign RD2 = _02_ ? 32'd0 : _04_;
  assign _00_[30:0] = { _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31], _00_[31] };
endmodule
