import * as React from "react";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import Whatsapp from "../components/jsx-icons/Whatsapp";
import PhoneCall from "../components/jsx-icons/PhoneCall";
import ComplaintModal from "../components/modals/ComplaintModal";
import SupportAgentIcon from '@mui/icons-material/SupportAgent';

export default function HomeSpeedDial() {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);

  const handleClose = () => setOpen(false);

  const actions = [
    {
      icon: <Whatsapp width={24} height={24} />,
      name: "Whatsapp",
      onClick: () => {
        window.open("https://wa.me/message/2B4FJIHWGOVFN1");
        handleClose();
      },
    },

    {
      icon: <PhoneCall width={24} height={24} />,
      name: "Phone Call",
      onClick: () => {
        window.open("tel:+233244012766");
        handleClose();
      },
    },
    {
      icon: <ComplaintModal buttonVariant="fab" buttonText="Complaint form" />,
      name: "Help & Support",
      onClick: () => {
        handleClose();
      },
    },
  ];

  return (
    <SpeedDial
      ariaLabel="SpeedDial tooltip example"
      sx={{
        display: "flex",
        position: "fixed",
        bottom: "12%",
        left: "1%",
      }}
      icon={<SupportAgentIcon />}
      onClose={handleClose}
      onOpen={handleOpen}
      open={open}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          // tooltipOpen
          tooltipPlacement="bottom"
          onClick={action.onClick}
        />
      ))}
    </SpeedDial>
  );
}
