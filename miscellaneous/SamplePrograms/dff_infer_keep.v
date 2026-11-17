// Pure Verilog-2001 version of dff_infer.v, used only by SECTION 5 of
// dff_infer.ys.
// The always block carries the attribute "keep", which stops opt_merge from
// sharing the two identical registers, so the netlist really contains
// 2 x 8 = 16 flip-flops.
// Note: in Yosys 0.33 the attribute must sit on the always block - a
// (* keep *) on the "reg_b" declaration is not propagated to the FF cells
// and the merge still happens.
module dff_infer (
    input        clk,
    input        reset,
    input        enable,
    input  [7:0] data_in,
    output [7:0] out_a,
    output [7:0] out_b
);

    reg [7:0] reg_a;
    reg [7:0] reg_b;

    (* keep *) always @(posedge clk)
        if (reset) begin
            reg_a <= 8'd0;
            reg_b <= 8'd0;
        end else if (enable) begin
            reg_a <= data_in;
            reg_b <= data_in;
        end

    assign out_a = reg_a;
    assign out_b = reg_b;

endmodule
