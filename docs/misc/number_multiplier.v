module transfer (
    input  [7:0]  data,
    output [11:0] result
);

    wire [11:0] data_ext;

    assign data_ext = {4'b0000, data};
    assign result = data_ext * (12'd13 + 12'd3);   // coefficients fold to 16 -> fixed shift

endmodule
