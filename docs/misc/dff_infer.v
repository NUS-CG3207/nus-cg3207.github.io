// Pure Verilog-2001 version of the original SystemVerilog snippet:
//   logic      -> reg (registered signals), ports driven by assign stay wires
//   always_ff  -> always @(posedge clk)
// Parses with plain "read_verilog" (no -sv needed).
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

    always @(posedge clk)
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
