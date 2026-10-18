# Prerequisites for lab work

## Knowledge and skills expected

This course is designed for students with a reasonably solid background in digital design and computer organization.

The official course prerequisites are CG2028 or EE2028. However, EE2026 (Digital Design) will be a strong plus, too.

If you are coming from CS2100DE - first of all, welcome back! Remembering most of CS2100DE will be more than sufficient for this course.

!!! danger "Preparation is the key to success"
    The labs for this course constitute a large percentage of your final grade (40%!), and not knowing how to design for an FPGA will make your life unnecessarily difficult.

    If you haven't taken, or don't remember very well, the content from either CS2100DE or EE2026 - we highly, *highly*, **highly** recommend (did I mention we highly recommend?) working through the [manuals for labs 1 through 4 from CS2100DE](https://nus-cs2100de.github.io/labs). We recommend working through these in the first 3 weeks of the semester, before starting the CG3207 labs.

    If you are an official student for the course, [drop the teaching team an email](mailto:neil@nus.edu.sg), and we will do our best to let you borrow a Nexys 4 FPGA board early, so you can work through the aforementioned labs.

## Hardware required

For this course, you will need an FPGA development board. We will provide you a [Nexys 4 board](nexys4.md), and our materials will expect you to use this specific board. You will also need a Windows or Linux (preferred) computer to run the software to program this FPGA. The PCs in the lab will have the software required for this course installed for you, and you may use these as well.

!!! note

 If you are not an official student of this course, and do not have access to a Nexys 4 board to follow along, you can use any other Xilinx/AMD FPGA development board, like the Basys 3 or Arty A7. You may need to make some changes to your code and project files to account for the different FPGA and different available peripherals. You may also be able to use a completely different brand of FPGA, like an Intel or Sipeed board. However, you will not be able to use Vivado, nor our template files.

The FPGA board comes with a USB type A to USB micro-B cable. You will need a USB type A port on your laptop, and if you do not have one, you must use an adapter. Remember to bring one to class.

## Software required

The software you will use to program your FPGA board is [Vivado](https://www.amd.com/en/products/software/adaptive-socs-and-fpgas/vivado.html). Installation instructions can be found [here](vivado_install_guide.md). Please install Vivado before coming for your first lab in Week 4.

To explore RISC-V assembly, we will use the [RARS architecture simulator](https://github.com/TheThirdOne/rars). This runs on Windows, macOS and Linux, and does not require any installation and can be run by double clicking the downloaded jar file or by running `java -jar filename.jar` where `filename` is the name of the jar file you downloaded.