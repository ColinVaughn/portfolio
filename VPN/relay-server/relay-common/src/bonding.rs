use bitflags::bitflags;
use serde::{Deserialize, Serialize};
use std::io;

pub const MAGIC_BYTE: u8 = 0xB0;
pub const BONDING_HEADER_LEN: usize = 16;

bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct PacketFlags: u8 {
        const IS_DUPLICATE = 0b0000_0001;
        const IS_CONTROL   = 0b0000_0010;
        const ACK_REQUEST  = 0b0000_0100;
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BondingHeader {
    pub magic: u8,
    pub flags: PacketFlags,
    pub channel_id: u16,
    pub sequence: u32,
    pub timestamp_us: u32,
    pub payload_length: u16,
    pub reserved: u16,
}

impl BondingHeader {
    pub fn new(flags: PacketFlags, channel_id: u16, sequence: u32, payload_length: u16) -> Self {
        Self {
            magic: MAGIC_BYTE,
            flags,
            channel_id,
            sequence,
            timestamp_us: 0, // Set later when sending
            payload_length,
            reserved: 0,
        }
    }

    pub fn write_to(&self, out: &mut [u8]) -> io::Result<()> {
        if out.len() < BONDING_HEADER_LEN {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Buffer too small for header",
            ));
        }
        out[0] = self.magic;
        out[1] = self.flags.bits();
        out[2..4].copy_from_slice(&self.channel_id.to_be_bytes());
        out[4..8].copy_from_slice(&self.sequence.to_be_bytes());
        out[8..12].copy_from_slice(&self.timestamp_us.to_be_bytes());
        out[12..14].copy_from_slice(&self.payload_length.to_be_bytes());
        out[14..16].copy_from_slice(&self.reserved.to_be_bytes());
        Ok(())
    }

    pub fn read_from(data: &[u8]) -> io::Result<Self> {
        if data.len() < BONDING_HEADER_LEN {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "Data too short for header",
            ));
        }
        let magic = data[0];
        if magic != MAGIC_BYTE {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Invalid magic byte",
            ));
        }
        let flags = PacketFlags::from_bits_truncate(data[1]);

        let mut id_buf = [0u8; 2];
        id_buf.copy_from_slice(&data[2..4]);
        let channel_id = u16::from_be_bytes(id_buf);

        let mut seq_buf = [0u8; 4];
        seq_buf.copy_from_slice(&data[4..8]);
        let sequence = u32::from_be_bytes(seq_buf);

        let mut ts_buf = [0u8; 4];
        ts_buf.copy_from_slice(&data[8..12]);
        let timestamp_us = u32::from_be_bytes(ts_buf);

        let mut len_buf = [0u8; 2];
        len_buf.copy_from_slice(&data[12..14]);
        let payload_length = u16::from_be_bytes(len_buf);

        let mut res_buf = [0u8; 2];
        res_buf.copy_from_slice(&data[14..16]);
        let reserved = u16::from_be_bytes(res_buf);

        Ok(Self {
            magic,
            flags,
            channel_id,
            sequence,
            timestamp_us,
            payload_length,
            reserved,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Copy, Clone)]
pub enum BondingMode {
    Speed,
    Redundant,
    Quality,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum InterfaceType {
    Ethernet,
    WiFi,
    Cellular,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub id: u16,
    pub name: String,
    pub interface_type: InterfaceType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControlMessage {
    ChannelAnnounce {
        session_token: [u8; 16],
        channel: ChannelInfo,
        mode: BondingMode,
    },
    ChannelAck {
        channel_id: u16,
    },
    Ping {
        channel_id: u16,
        timestamp_us: u32,
    },
    Pong {
        channel_id: u16,
        server_timestamp_us: u32,
        client_timestamp_us: u32,
    },
}
