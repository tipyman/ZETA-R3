/**
* makecode ZETA-R3 module Package Release 1
* By 2025 Socionext Inc. and ZETA alliance Japan
* Written by M.Urade　2025/12/4
*/

/**
 * ZETA-R3 block Ver1
 */
//% weight=100 color=#0096FF icon="\uf434" block="ZETA-R3"

namespace ZETA_R3 {
    let buffer: Buffer = Buffer.create(0)
    let dataBuffer = pins.createBuffer(1);
    pins.digitalWritePin(DigitalPin.P2, 0)  // Wakeup off

    /**
     * Binary data transmission over UART
     * @param TX_data: 8bit data 
    */
    function UART_BIN_TX(TX_data: number): void {
        dataBuffer.setUint8(0, TX_data);
        // Write buffer to serial port
        serial.writeBuffer(dataBuffer)
    }

    /**
     * Binary data reception over UART
     * @param value: none
     * @return value: 16bit data If return value is 256, reception time out. 
    */
    // Check RX up to 256 times
    // If data reception is OK, return reciept data, if not, retunr 0x100
    function UART_BIN_RX(): number {
        buffer = serial.readBuffer(1)
        if (buffer.length > 0) {
            return buffer[0]
        }
        return 0x100
    }

    // CRC16 XMODEM calculation
    function crc16(data: number[]) {
        let crc = 0
        for (let i = 0; i <= data.length - 1; i++) {
            crc ^= (data[i] << 8)
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) != 0) {
                    crc = (crc << 1) ^ 0x1021
                } else {
                    crc <<= 1
                }
                crc &= 0xFFFF
            }
        }
        return crc
    }

    /**
     * ZETA command execution
     * @param TX_array : number[]
     * @return Query_array[]
    */
    //% blockId=ZETA_command_execution block="ZETA command assert %TX_array"
    //% weight=80 blockGap=8
    export function command_assert(TX_array: number[]) {
        pins.digitalWritePin(DigitalPin.P2, 0)  // wakeup on
        basic.pause(20)     // The specification requires 10 milliseconds, but settle 20msec for safety
        let Array_length = TX_array.length
        let crc_check = TX_array.slice(2)
        let crc16_data = crc16(crc_check)
        TX_array.push((crc16_data >> 8) & 0xff)
        TX_array.push(crc16_data & 0xff)
        let k = 0
        for (let l = 0; l < Array_length + 2; l++) {
            UART_BIN_TX(TX_array[k])
            k += 1
        }
        basic.pause(100)    // May not need this wait times
        pins.digitalWritePin(DigitalPin.P2, 1)  // wakeup off
        let Query_array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        Query_array = receive_query()
        return Query_array
    }

    /**
     * ZETA data transmission
     * @param TX_array : number[]
     * @return acknowlege: number
    */
    //% blockId=ZETA_data_transmission block="ZETA data transmission %TX_array"
    //% weight=80 blockGap=8
    export function data_tx(TX_array: number[]) {
        let Array_length2 = TX_array.length
        let data_array = [0xfa, 0xf5, Array_length2 + 3, 2]
        let Query_array2 = command_assert(data_array.concat(TX_array))
        return Query_array2[3]
    }

    //% blockId=Inquiry MAC address block="Inquiry MAC address"
    //% weight=80 blockGap=8
    export function Inquire_MAC(): number[] {
        let temp = [0, 0, 0, 0, 0, 0, 0, 0]
        temp = command_assert([0xfa, 0xf5, 0x03, 0x10])
        temp[0] = temp[4]
        temp[1] = temp[5]
        temp[2] = temp[6]
        temp[3] = temp[7]
        return temp
    }

    //% blockId= Inquire_Module_Status block="Inquire Module Status"
    //% weight=80 blockGap=8
    export function Inquire_Module_Status(): number {
        let temp = command_assert([0xfa, 0xf5, 0x03, 0x14])
        return temp[3]
    }

    //% blockId= Inquire_Version="Inquire Protocol version"
    //% weight=80 blockGap=8
    export function Inquire_Version(): number {
        let temp = command_assert([0xfa, 0xf5, 0x03, 0])
        return ((temp[4] << 8) + temp[5]);
    }

    //% blockId= Inquire_Network_Time="Inquire network time"
    //% weight=80 blockGap=8
    export function Inquire_Network_Time(): number[] {
        const temp = command_assert([0xfa, 0xf5, 0x03, 0x11]).slice(4, 11);
        return temp;
    }

    //% blockId= Inquire_Network_Quality="Inquire network quality"
    //% weight=80 blockGap=8
    export function Inquire_Network_Quality(): number {
        const temp = command_assert([0xfa, 0xf5, 0x03, 0x13]);
        return temp[4];
    }

    //% blockId= Receive_query data block="Receive query data"
    //% weight=80 blockGap=8
    export function receive_query(): number[] {
        let temp3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        let m = 0   // Waiting timer
        while (1) {
            let data = UART_BIN_RX()
            if (data == 0xfa) {
                break;
            }
            m += 1;
            if (m > 15) {
                return temp3
            }
        }
        if (UART_BIN_RX() == 0xf5) {
            temp3[0] = 0xfa
            temp3[1] = 0xf5
            let counter = UART_BIN_RX()
            temp3[2] = counter
            m = 3
            for (let n = 0; n < counter; n++) {
                temp3[m] = UART_BIN_RX()
                m += 1
            }
        }
        return temp3
    }
}
