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
--	(c) Rajesh Panicker
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
  wire [31:0] _0_;
  wire [7:0] _100_;
  wire [7:0] _101_;
  wire [7:0] _102_;
  wire _103_;
  wire [7:0] _104_;
  wire _105_;
  wire [7:0] _106_;
  wire _107_;
  wire _108_;
  wire [31:0] _109_;
  wire [31:0] _10_;
  wire [32:0] _110_;
  wire [31:0] _111_;
  wire [31:0] _112_;
  wire [31:0] _113_;
  wire _114_;
  wire _115_;
  wire _116_;
  wire _117_;
  wire _118_;
  wire _119_;
  wire [31:0] _11_;
  wire _120_;
  wire _121_;
  wire _122_;
  wire _123_;
  wire _124_;
  wire [31:0] _125_;
  wire _126_;
  wire _127_;
  wire _128_;
  wire _129_;
  wire [32:0] _12_;
  wire [31:0] _130_;
  wire [31:0] _131_;
  wire [31:0] _132_;
  wire _133_;
  wire _134_;
  wire _135_;
  wire _136_;
  wire _137_;
  wire _138_;
  wire _139_;
  wire _13_;
  wire _140_;
  wire _141_;
  wire _142_;
  wire _143_;
  wire _144_;
  wire _145_;
  wire _146_;
  wire _147_;
  wire [7:0] _148_;
  wire [63:0] _149_;
  wire [31:0] _14_;
  wire [63:0] _150_;
  wire [63:0] _151_;
  wire [31:0] _152_;
  wire [31:0] _153_;
  wire _154_;
  wire _155_;
  wire _156_;
  wire [63:0] _157_;
  wire [63:0] _158_;
  wire [7:0] _159_;
  wire _15_;
  wire _160_;
  wire [63:0] _161_;
  wire _162_;
  wire [63:0] _163_;
  wire [63:0] _164_;
  wire [63:0] _165_;
  wire _166_;
  wire [63:0] _167_;
  wire [31:0] _168_;
  wire [31:0] _169_;
  wire [1:0] _16_;
  wire [63:0] _170_;
  wire [31:0] _171_;
  wire [31:0] _172_;
  wire [31:0] _173_;
  wire _174_;
  wire _175_;
  wire _176_;
  wire _177_;
  wire _178_;
  wire _179_;
  wire [1:0] _17_;
  wire _180_;
  wire [31:0] _181_;
  wire _182_;
  wire [31:0] _183_;
  wire [31:0] _184_;
  wire _185_;
  wire _186_;
  wire _187_;
  wire [63:0] _188_;
  wire [31:0] _189_;
  wire [2:0] _18_;
  wire [31:0] _190_;
  wire [31:0] _191_;
  wire [31:0] _192_;
  wire _193_;
  wire _194_;
  wire _195_;
  wire _196_;
  wire _197_;
  wire _198_;
  wire _199_;
  wire _19_;
  wire _1_;
  wire _200_;
  wire _201_;
  wire _202_;
  wire _203_;
  wire _204_;
  wire _205_;
  wire _206_;
  wire _207_;
  wire [15:0] _208_;
  wire _209_;
  wire _20_;
  wire [15:0] _210_;
  wire _211_;
  wire [7:0] _212_;
  wire _213_;
  wire _214_;
  wire _215_;
  wire [7:0] _216_;
  wire _217_;
  wire _218_;
  wire [7:0] _219_;
  wire [2:0] _21_;
  wire [7:0] _220_;
  wire _221_;
  wire _222_;
  wire [7:0] _223_;
  wire [7:0] _224_;
  wire _225_;
  wire _226_;
  wire [7:0] _227_;
  wire _22_;
  wire [1:0] _23_;
  wire _24_;
  wire [31:0] _25_;
  wire _26_;
  reg [31:0] _27_;
  reg [31:0] _28_;
  reg [7:0] _29_ = 8'h00;
  wire _2_;
  reg _30_ = 1'h0;
  wire [7:0] _31_;
  wire _32_;
  wire _33_;
  wire _34_;
  wire [63:0] _35_;
  wire [63:0] _36_;
  wire [63:0] _37_;
  reg _38_ = 1'h0;
  reg _39_ = 1'h0;
  wire _3_;
  wire _40_;
  wire _41_;
  reg [63:0] _42_ = 64'h0000000000000000;
  reg [63:0] _43_ = 64'h0000000000000000;
  reg _44_ = 1'h0;
  reg [63:0] _45_ = 64'h0000000000000000;
  wire [31:0] _46_;
  wire [1:0] _47_;
  wire [31:0] _48_;
  wire _49_;
  wire [31:0] _4_;
  wire [31:0] _50_;
  wire [31:0] _51_;
  wire [31:0] _52_;
  wire [31:0] _53_;
  wire _54_;
  wire _55_;
  wire _56_;
  wire _57_;
  wire _58_;
  wire _59_;
  wire [3:0] _5_;
  wire _60_;
  wire _61_;
  wire _62_;
  wire _63_;
  wire _64_;
  wire _65_;
  wire _66_;
  wire _67_;
  wire [31:0] _68_;
  wire [31:0] _69_;
  wire [2:0] _6_;
  wire [31:0] _70_;
  wire [31:0] _71_;
  wire [31:0] _72_;
  wire [31:0] _73_;
  wire [31:0] _74_;
  wire [3:0] _75_;
  wire [3:0] _76_;
  wire [2:0] _77_;
  wire [2:0] _78_;
  wire [1:0] _79_;
  wire _7_;
  wire [1:0] _80_;
  wire [1:0] _81_;
  wire [1:0] _82_;
  wire [30:0] _83_;
  wire [30:0] _84_;
  wire [30:0] _85_;
  wire _86_;
  wire [1:0] _87_;
  wire [1:0] _88_;
  wire _89_;
  wire [32:0] _8_;
  wire _90_;
  wire _91_;
  wire _92_;
  wire _93_;
  wire _94_;
  wire [31:0] _95_;
  wire [31:0] _96_;
  wire [15:0] _97_;
  wire [7:0] _98_;
  wire [7:0] _99_;
  wire [31:0] _9_;
  RegFile RegFile1 (
    .CLK(CLK),
    .RD1(_50_),
    .RD2({ _51_[31:8], WriteData_out[7:0] }),
    .WD(_53_),
    .WE(_54_),
    .rd(Instr[11:7]),
    .rs1(Instr[19:15]),
    .rs2(Instr[24:20])
  );
  assign _4_ = _109_ + { Instr[31], _25_[30:0] };
  assign _125_ = _9_ ^ _11_;
  assign _126_ = _9_[31] ^ _11_[31];
  assign _6_[1] = _8_[31] ^ _13_;
  assign _127_ = { _5_[3], _5_[0] } == 2'h3;
  assign _128_ = { _5_[3], _5_[0] } == 2'h2;
  assign _129_ = ! { _5_[3], _5_[0] };
  assign _130_ = _9_ << _11_[4:0];
  assign _131_ = _9_ >> _11_[4:0];
  assign _132_ = $signed(_9_) >>> _11_[4:0];
  assign _19_ = _137_ & _138_;
  assign _57_ = _120_ | _119_;
  assign _133_ = Instr[13] & Instr[12];
  assign _134_ = | { _141_, _81_[0] };
  assign _135_ = | { _140_, _142_, _143_, MemRead, _22_ };
  assign _24_ = | { _137_, _140_, _141_, _142_, _143_, MemRead, _81_[0] };
  assign _80_[1] = | { _141_, _143_, _81_[0] };
  assign _77_[0] = | { _140_, MemRead, _81_[0] };
  assign _136_ = Instr[14:12] == 3'h5;
  assign _138_ = Instr[31:25] == 7'h01;
  assign _139_ = Instr[13] | Instr[12];
  assign _142_ = Instr[6:0] == 7'h37;
  assign _58_ = _128_ | _127_;
  assign _143_ = Instr[6:0] == 7'h17;
  assign _140_ = Instr[6:0] == 7'h13;
  assign _137_ = Instr[6:0] == 7'h33;
  assign _82_[0] = Instr[6:0] == 7'h63;
  assign _22_ = Instr[6:0] == 7'h23;
  assign MemRead = Instr[6:0] == 7'h03;
  assign _81_[0] = Instr[6:0] == 7'h67;
  assign _141_ = Instr[6:0] == 7'h6f;
  assign _15_ = _136_ & Instr[30];
  assign _21_[1] = Instr[14] ? Instr[12] : _133_;
  assign _59_ = _140_ | _82_[0];
  assign _21_[0] = Instr[14] ? Instr[12] : Instr[13];
  assign _20_ = Instr[14] ? Instr[13] : _139_;
  assign _144_ = _18_ == 3'h7;
  assign _145_ = _18_ == 3'h6;
  assign _146_ = _18_ == 3'h3;
  assign _147_ = _18_ == 3'h2;
  assign _168_ = _181_ + 1'h1;
  assign _169_ = _112_ + 1'h1;
  assign _170_ = _151_ + _149_;
  assign { _171_[31:8], _159_ } = _148_ + 32'd1;
  assign _60_ = _141_ | _77_[0];
  assign _172_ = _183_ + 1'h1;
  assign _173_ = _184_ + 1'h1;
  assign _174_ = _26_ & _178_;
  assign _175_ = _193_ & _187_;
  assign _176_ = _21_[0] & _162_;
  assign _177_ = _182_ & _179_;
  assign _40_ = _185_ & _9_[31];
  assign _41_ = _182_ & _11_[31];
  always @(posedge CLK)
    if (_26_) _28_ <= _153_;
  always @(posedge CLK)
    if (_26_) _27_ <= _152_;
  assign _61_ = _135_ | _134_;
  assign _179_ = _148_ == 8'h3f;
  assign _162_ = _148_ == 8'h1f;
  assign _166_ = { _151_[62:0], _149_[31] } >= _150_;
  assign _181_ = ~ _9_;
  assign _182_ = ~ _21_[0];
  assign _183_ = ~ { _149_[30:0], _166_ };
  assign _184_ = ~ _167_[31:0];
  assign _185_ = ~ _21_[1];
  assign _186_ = RESET | _174_;
  assign _160_ = _176_ | _177_;
  assign _62_ = _142_ | _80_[1];
  always @(posedge CLK)
    _44_ <= _26_;
  always @(posedge CLK)
    _30_ <= _32_;
  always @(posedge CLK)
    _29_ <= _31_;
  always @(posedge CLK)
    _45_ <= _37_;
  always @(posedge CLK)
    _42_ <= _35_;
  always @(posedge CLK)
    _43_ <= _36_;
  always @(posedge CLK)
    _38_ <= _33_;
  always @(posedge CLK)
    _39_ <= _34_;
  assign _167_ = _166_ ? _188_ : { _151_[62:0], _149_[31] };
  assign _163_[0] = Instr[14] & _166_;
  assign _63_ = _141_ | _81_[0];
  assign _165_ = _150_[0] ? _170_ : _151_;
  assign _152_ = Instr[14] ? _191_ : _165_[31:0];
  assign _153_ = Instr[14] ? _192_ : _165_[63:32];
  assign _154_ = Instr[14] ? _162_ : _160_;
  assign _164_ = Instr[14] ? _150_ : { 1'h0, _150_[63:1] };
  assign _161_ = Instr[14] ? _167_ : _165_;
  assign _36_ = _26_ ? _164_ : _150_;
  assign _35_ = _26_ ? { _149_[62:0], _163_[0] } : _149_;
  assign _37_ = _26_ ? _161_ : _151_;
  assign _32_ = _26_ & _154_;
  assign _64_ = _145_ | _144_;
  assign _31_ = _26_ ? _159_ : _148_;
  assign { _158_[63], _158_[31:0] } = Instr[14] ? { 1'h0, _190_ } : { _41_, _11_ };
  assign { _157_[63], _157_[31:0] } = Instr[14] ? { 1'h0, _189_ } : { _40_, _9_ };
  assign _156_ = Instr[14] & _40_;
  assign _155_ = Instr[14] & _175_;
  assign _34_ = _186_ ? _156_ : _39_;
  assign _33_ = _186_ ? _155_ : _38_;
  assign _150_ = _186_ ? { _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[31:0] } : _43_;
  assign _149_ = _186_ ? { _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[31:0] } : _42_;
  assign _151_ = _186_ ? 64'h0000000000000000 : _45_;
  assign _65_ = _195_ | _87_[1];
  assign _148_ = _186_ ? 8'h00 : _29_;
  assign _26_ = RESET ? 1'h0 : _86_;
  assign _180_ = ~ _30_;
  assign _178_ = ~ _44_;
  assign _187_ = | _11_;
  assign _188_ = { _151_[62:0], _149_[31] } - _150_;
  assign _189_ = _40_ ? _168_ : _9_;
  assign _190_ = _41_ ? _169_ : _11_;
  assign _191_ = _33_ ? _172_ : { _149_[30:0], _166_ };
  assign _192_ = _34_ ? _173_ : _167_[31:0];
  assign _66_ = _199_ | _198_;
  assign _0_[31:2] = PC[31:2] + 30'h00000001;
  assign _193_ = _40_ ^ _41_;
  assign _194_ = ~ _6_[1];
  assign _87_[1] = _23_ == 2'h3;
  assign _195_ = _23_ == 2'h2;
  assign _196_ = Instr[14:12] == 3'h7;
  assign _197_ = Instr[14:12] == 3'h6;
  assign _198_ = Instr[14:12] == 3'h4;
  assign _199_ = Instr[14:12] == 3'h1;
  assign _200_ = ! Instr[14:12];
  assign _201_ = _23_ == 2'h1;
  assign _67_ = _214_ | _213_;
  assign _48_ = _3_ ? _4_ : { _0_[31:2], PC[1:0] };
  assign _202_ = _47_ == 2'h3;
  assign _203_ = _47_ == 2'h1;
  assign _204_ = _16_ == 2'h3;
  assign _205_ = _16_ == 2'h1;
  assign _206_ = _17_ == 2'h3;
  assign _207_ = _17_ == 2'h1;
  assign _208_[15] = Instr[14] ? 1'h0 : ReadData_in[15];
  assign _212_ = ALUResult[1] ? ReadData_in[23:16] : ReadData_in[7:0];
  assign _216_ = ALUResult[1] ? ReadData_in[31:24] : ReadData_in[15:8];
  assign _55_ = | { _118_, _117_, _116_, _115_, _114_ };
  assign _210_[15] = Instr[14] ? 1'h0 : ReadData_in[7];
  assign _218_ = _2_ ? 1'h0 : _22_;
  assign _219_ = ALUResult[1] ? WriteData_out[7:0] : _51_[23:16];
  assign _220_ = _213_ ? WriteData_out[7:0] : _51_[23:16];
  assign _222_ = _215_ & _22_;
  assign _223_ = ALUResult[1] ? _51_[15:8] : _51_[31:24];
  assign _224_ = _2_ ? _51_[31:24] : WriteData_out[7:0];
  assign _215_ = ! ALUResult[1:0];
  assign _217_ = ALUResult[1] & _22_;
  assign _225_ = _213_ & _22_;
  assign _56_ = | { _196_, _136_, _197_ };
  assign _213_ = ALUResult[1:0] == 2'h2;
  assign _221_ = ALUResult[1] ? 1'h0 : _22_;
  assign _209_ = Instr[13:12] == 2'h1;
  assign _226_ = _214_ & _22_;
  assign _227_ = _214_ ? WriteData_out[7:0] : _51_[15:8];
  assign _214_ = ALUResult[1:0] == 2'h1;
  assign WriteData_out[15:8] = _211_ ? _227_ : _51_[15:8];
  assign _211_ = ! Instr[13:12];
  assign _46_ = _20_ ? _28_ : _27_;
  assign _14_ = _19_ ? _46_ : ALUResult;
  assign _68_ = _115_ ? { 31'h00000000, _6_[1] } : _10_;
  assign _53_ = MemRead ? _52_ : _14_;
  assign _69_ = _114_ ? { 31'h00000000, _6_[0] } : _68_;
  assign _70_ = _119_ ? _111_ : _113_;
  assign _71_ = _121_ ? _125_ : _8_[31:0];
  assign _72_ = _57_ ? _70_ : _71_;
  assign ALUResult = _55_ ? _69_ : _72_;
  assign _73_ = _127_ ? _132_ : _131_;
  assign _54_ = _24_ & _49_;
  assign _74_ = _129_ ? _130_ : _9_;
  assign _10_ = _58_ ? _73_ : _74_;
  assign _75_ = _82_[0] ? 4'h1 : { Instr[14:12], _15_ };
  assign _76_ = _137_ ? { Instr[14:12], Instr[30] } : 4'h0;
  assign _5_ = _59_ ? _75_ : _76_;
  assign { _78_[2], _78_[0] } = _82_[0] ? 2'h3 : { _22_, 1'h0 };
  assign _18_ = _60_ ? { 2'h1, _77_[0] } : { _78_[2], _78_[2], _78_[0] };
  assign _79_[1] = ~ _134_;
  assign _17_ = _61_ ? { _79_[1], 1'h1 } : 2'h0;
  assign _16_ = _62_ ? { _80_[1], 1'h1 } : 2'h0;
  always @(posedge CLK)
    if (RESET) PC[1:0] <= 2'h0;
    else if (_1_) PC[1:0] <= _4_[1:0];
  assign _23_ = _63_ ? { 1'h1, _81_[0] } : { 1'h0, _82_[0] };
  assign { _83_[11], _83_[0] } = _144_ ? { Instr[7], 1'h0 } : { Instr[31], Instr[7] };
  assign { _84_[30:20], _84_[11:1] } = _147_ ? { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[20], Instr[30:21] } : { Instr[30:20], 11'h000 };
  assign _85_ = _146_ ? { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31:20] } : { _84_[30:20], Instr[19:12], _84_[11:1], 1'h0 };
  assign _25_[30:0] = _64_ ? { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], _83_[11], Instr[30:25], Instr[11:8], _83_[0] } : _85_;
  assign _86_ = _44_ ? _180_ : _19_;
  assign _88_[0] = _201_ & _94_;
  assign _47_ = _65_ ? { _87_[1], 1'h1 } : { 1'h0, _88_[0] };
  assign _89_ = _197_ ? _6_[0] : _194_;
  assign _90_ = _196_ ? _8_[32] : _89_;
  always @(posedge CLK)
    if (RESET) PC[31:2] <= 30'h00100000;
    else if (!_26_) PC[31:2] <= _48_[31:2];
  assign _91_ = _198_ ? _6_[1] : _123_;
  assign _92_ = _200_ & _6_[2];
  assign _93_ = _66_ ? _91_ : _92_;
  assign _94_ = _56_ ? _90_ : _93_;
  assign _95_ = _205_ ? 32'd0 : _50_;
  assign _9_ = _204_ ? PC : _95_;
  assign _96_ = _207_ ? 32'd4 : { _51_[31:8], WriteData_out[7:0] };
  assign _11_ = _206_ ? { Instr[31], _25_[30:0] } : _96_;
  assign _97_ = _211_ ? { _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15] } : ReadData_in[31:16];
  assign _52_[31:16] = _209_ ? { _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15] } : _97_;
  assign _49_ = ~ _26_;
  assign _98_ = _211_ ? _101_ : ReadData_in[7:0];
  assign _52_[7:0] = _209_ ? _212_ : _98_;
  assign _99_ = _213_ ? ReadData_in[23:16] : ReadData_in[15:8];
  assign _100_ = _215_ ? ReadData_in[7:0] : ReadData_in[31:24];
  assign _101_ = _67_ ? _99_ : _100_;
  assign _102_ = _211_ ? { _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15] } : ReadData_in[15:8];
  assign _52_[15:8] = _209_ ? _216_ : _102_;
  assign _103_ = _211_ ? _218_ : _22_;
  assign MemWrite_out[3] = _209_ ? _217_ : _103_;
  assign _104_ = _211_ ? _220_ : _51_[23:16];
  assign _1_ = & { _3_, _49_ };
  assign WriteData_out[23:16] = _209_ ? _219_ : _104_;
  assign _105_ = _211_ ? _222_ : _22_;
  assign MemWrite_out[0] = _209_ ? _221_ : _105_;
  assign _106_ = _211_ ? _224_ : _51_[31:24];
  assign WriteData_out[31:24] = _209_ ? _223_ : _106_;
  assign _107_ = _211_ ? _225_ : _22_;
  assign MemWrite_out[2] = _209_ ? _217_ : _107_;
  assign _108_ = _211_ ? _226_ : _22_;
  assign MemWrite_out[1] = _209_ ? _221_ : _108_;
  assign _110_ = { 1'h0, _9_ } + { 1'h0, _12_[31:0] };
  assign _3_ = | { _203_, _202_ };
  assign _8_ = _110_ + { 32'h00000000, _7_ };
  assign _111_ = _9_ & _11_;
  assign _13_ = _126_ & _124_;
  assign _6_[2] = ! _123_;
  assign _112_ = ~ _11_;
  assign _6_[0] = ~ _8_[32];
  assign _113_ = _9_ | _11_;
  assign _116_ = _5_ == 4'hb;
  assign _117_ = _5_ == 4'ha;
  assign _118_ = _5_ == 4'h2;
  assign _109_ = _202_ ? _50_ : PC;
  assign _119_ = _5_ == 4'he;
  assign _120_ = _5_ == 4'hc;
  assign _121_ = _5_ == 4'h8;
  assign _12_[31:0] = _7_ ? _112_ : _11_;
  assign _7_ = | { _122_, _115_, _114_ };
  assign _122_ = _5_ == 4'h1;
  assign _115_ = _5_ == 4'h4;
  assign _114_ = _5_ == 4'h6;
  assign _123_ = | _8_[31:0];
  assign _124_ = _11_[31] ~^ _8_[31];
  assign _2_ = | { _215_, _214_, _213_ };
  assign _77_[2:1] = 2'h1;
  assign _78_[1] = _78_[2];
  assign _79_[0] = 1'h1;
  assign _80_[0] = 1'h1;
  assign _81_[1] = 1'h1;
  assign _82_[1] = 1'h0;
  assign { _83_[30:12], _83_[10:1] } = { Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31], Instr[31:25], Instr[11:8] };
  assign { _84_[19:12], _84_[0] } = { Instr[19:12], 1'h0 };
  assign _87_[0] = 1'h1;
  assign _88_[1] = 1'h0;
  assign _157_[62:32] = { _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63], _157_[63] };
  assign _158_[62:32] = { _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63], _158_[63] };
  assign _163_[63:1] = _149_[62:0];
  assign _171_[7:0] = _159_;
  assign _208_[14:0] = { _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15], _208_[15] };
  assign _210_[14:0] = { _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15], _210_[15] };
  assign _12_[32] = 1'h0;
  assign _21_[2] = Instr[14];
  assign _25_[31] = Instr[31];
  assign _51_[7:0] = WriteData_out[7:0];
  assign _0_[1:0] = PC[1:0];
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
