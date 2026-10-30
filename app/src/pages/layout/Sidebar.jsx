import {  useEffect, useMemo } from "react";
import {
  Drawer,
  Box,
  Avatar,
  IconButton,
  List,
  ListSubheader,
  Typography,
  Badge,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  keyframes,
} from "@mui/material";
import Swal from "sweetalert2";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DashboardRounded,
  Bolt,
  LocalOffer,
  PersonOutlined,
  NotificationsOutlined,
  WalletOutlined,
  NoteAltOutlined,
  ExitToAppRounded,
  ReceiptLong,
  Close,
} from "@mui/icons-material";
import { useAuth } from "../../context/providers/AuthProvider";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { IMAGES } from "../../constants";
import NavLinkItem from "@/components/NavLinkItem";
import NavLinkItemCollapse from "@/components/modals/NavLinkItemCollapse";

// Pulse animation for the notification badge
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

function Sidebar() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const {
    customState: { openSidebar },
    customDispatch,
  } = useCustomContext();

  const { pathname } = useLocation();
  const theme = useTheme();

  // Fetch notifications (only for logged-in users)
  const notifications = queryClient.getQueryData({
    queryKey: ["notifications", user?.id],
  });

  const unreadCount = useMemo(
    () =>
      notifications?.filter((item) => item?.active && !item.isRead).length || 0,
    [notifications],
  );

  // Close sidebar on navigation
  useEffect(() => {
    customDispatch({ type: "openSidebar", payload: false });
  }, [pathname, customDispatch]);

  const handleClose = () => {
    customDispatch({ type: "openSidebar", payload: false });
  };

  const handleLogout = () => {
    Swal.fire({
      title: "Logging out",
      text: "Do you want to log out?",
      showCancelButton: true,
      confirmButtonColor: theme.palette.error.main,
      cancelButtonColor: theme.palette.grey[500],
    }).then(async ({ isConfirmed }) => {
      if (isConfirmed) {
        logout();
      }
    });
  };

  return (
    <Drawer
      anchor="left"
      open={openSidebar}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 300 },
          borderTopRightRadius: { xs: 0, sm: 16 },
          borderBottomRightRadius: { xs: 0, sm: 16 },
          boxShadow: theme.shadows[8],
          bgcolor: theme.palette.background.paper,
          transition: theme.transitions.create(
            ["box-shadow", "border-radius"],
            {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            },
          ),
        },
      }}
      // Optional: add a subtle backdrop blur effect (works in modern browsers)
      ModalProps={{
        BackdropProps: {
          sx: {
            backdropFilter: { xs: "none", sm: "blur(4px)" },
            bgcolor: { xs: "rgba(0,0,0,0.5)", sm: "rgba(0,0,0,0.2)" },
          },
        },
      }}
    >
      {/* Header with logo and close button */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        }}
      >
        <Avatar
          src={IMAGES.logo}
          alt="logo"
          sx={{
            width: 36,
            height: 36,
            // boxShadow: theme.shadows[2],
          }}
        />
        <IconButton
          onClick={handleClose}
          aria-label="close sidebar"
          sx={{
            transition: theme.transitions.create(
              ["background-color", "transform"],
              {
                duration: theme.transitions.duration.short,
              },
            ),
            "&:hover": {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              transform: "scale(1.1)",
            },
          }}
        >
          <Close />
        </IconButton>
      </Box>

      {/* Main navigation area */}
      <Box
        sx={{
          p: 2,
          overflowY: "auto",
          flex: 1,
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: alpha(theme.palette.grey[500], 0.3),
            borderRadius: "10px",
          },
        }}
      >
        {user?.id ? (
          // Authenticated user
          <>
            {/* Optional: user greeting (adds a personal touch) */}
            <Box sx={{ mb: 2, px: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Welcome back,
              </Typography>
              <Typography variant="subtitle1" fontWeight="600" noWrap>
                {user?.firstname || "User"}
              </Typography>
            </Box>

            <List disablePadding>
              <NavLinkItem to="/" title="Home" icon={<DashboardRounded />} />

              <NavLinkItemCollapse
                icon={<LocalOffer />}
                title="Voucher & Tickets"
              >
                <NavLinkItem
                  to="/evoucher/waec-checker"
                  title="Waec & SHS Placement Checker"
                  // icon={<LocalOffer />}
                />
                <NavLinkItem
                  to="/evoucher/university-form"
                  title="University & Polytechnic Forms"
                  // icon={<SimCardOutlined />}
                />
                <NavLinkItem
                  to="/evoucher/security-service"
                  title=" Security Service Forms"
                  // icon={<SimCardOutlined />}
                />
                <NavLinkItem
                  to="/evoucher/cinema-ticket"
                  title="Cinema & Event Tickets"
                  // icon={<SimCardOutlined />}
                />
                <NavLinkItem
                  to="/evoucher/bus-ticket"
                  title=" Bus Tickets"
                  // icon={<SimCardOutlined />}
                />
                <NavLinkItem
                  to="/evoucher/stadia-ticket"
                  title="Stadium Tickets"
                  // icon={<SimCardOutlined />}
                />
              </NavLinkItemCollapse>
              <NavLinkItemCollapse icon={<Bolt />} title="Prepaid & Postpaid">
                <NavLinkItem
                  to="electricity"
                  title="Prepaid / Postpaid"
                  // icon={<LocalOffer />}
                />
                <NavLinkItem
                  to="electricity/meters"
                  title="My Meters"
                  // icon={<SimCardOutlined />}
                />
              </NavLinkItemCollapse>
              <NavLinkItem
                to="airtime"
                title="Airtime & Data Bundle"
                icon={<ReceiptLong />}
              />
            </List>

            <List
              disablePadding
              subheader={
                <ListSubheader
                  component="div"
                  sx={{
                    bgcolor: "transparent",
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    lineHeight: 2.5,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    px: 1,
                  }}
                >
                  Account
                </ListSubheader>
              }
              sx={{ mt: 3 }}
            >
              <NavLinkItem
                to="profile"
                title="Profile"
                icon={<PersonOutlined />}
              />
              <NavLinkItem
                to="notifications"
                title="Notifications"
                icon={
                  <Badge
                    badgeContent={unreadCount}
                    color="error"
                    sx={{
                      "& .MuiBadge-badge": {
                        animation:
                          unreadCount > 0 ? `${pulse} 1.5s infinite` : "none",
                        transition: theme.transitions.create("transform"),
                      },
                      fontSize: 10,
                    }}
                  >
                    <NotificationsOutlined />
                  </Badge>
                }
              />
              {/* <NavLinkItem
                to="wallet"
                title="Wallet"
                icon={<WalletOutlined />}
              /> */}
              <NavLinkItem
                to="transactions"
                title="Transactions"
                icon={<NoteAltOutlined />}
              />

              <ListItemButton
                onClick={handleLogout}
                sx={{
                  borderRadius: 2,
                  my: 0.5,
                  px: 1.5,
                  py: 1,
                  color: theme.palette.error.main,
                  transition: theme.transitions.create([
                    "background-color",
                    "color",
                  ]),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: "inherit",
                    transition: theme.transitions.create("transform"),
                    "&:hover": { transform: "scale(1.1)" },
                  }}
                >
                  <ExitToAppRounded />
                </ListItemIcon>
                <ListItemText
                  primary="Log Out"
                  primaryTypographyProps={{
                    variant: "body2",
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </List>
          </>
        ) : (
          // Unauthenticated user
          <>
            <List disablePadding>
              <List disablePadding>
                <NavLinkItem to="/" title="Home" icon={<DashboardRounded />} />

                <NavLinkItemCollapse
                  icon={<LocalOffer />}
                  title="Voucher & Tickets"
                >
                  <NavLinkItem
                    to="/evoucher/waec-checker"
                    title="Waec & SHS Placement Checker"
                    // icon={<LocalOffer />}
                  />
                  <NavLinkItem
                    to="/evoucher/university-form"
                    title="University & Polytechnic Forms"
                    // icon={<SimCardOutlined />}
                  />
                  <NavLinkItem
                    to="/evoucher/security-service"
                    title=" Security Service Forms"
                    // icon={<SimCardOutlined />}
                  />
                  <NavLinkItem
                    to="/evoucher/cinema-ticket"
                    title="Cinema & Event Tickets"
                    // icon={<SimCardOutlined />}
                  />
                  <NavLinkItem
                    to="/evoucher/bus-ticket"
                    title=" Bus Tickets"
                    // icon={<SimCardOutlined />}
                  />
                  <NavLinkItem
                    to="/evoucher/stadia-ticket"
                    title="Stadium Tickets"
                    // icon={<SimCardOutlined />}
                  />
                </NavLinkItemCollapse>
                <NavLinkItem
                  to="electricity"
                  title="Prepaid & Postpaid"
                  icon={<Bolt />}
                />

                <NavLinkItem
                  to="airtime"
                  title="Airtime & Data Bundle"
                  icon={<ReceiptLong />}
                />
              </List>
            </List>

            <List
              disablePadding
              subheader={
                <ListSubheader
                  component="div"
                  sx={{
                    bgcolor: "transparent",
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    lineHeight: 2.5,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    px: 1,
                  }}
                >
                  Account
                </ListSubheader>
              }
              sx={{ mt: 3 }}
            >
              <ListItemButton
                component={Link}
                to="/user/login"
                state={{ path: pathname }}
                sx={{
                  borderRadius: 2,
                  my: 0.5,
                  px: 1.5,
                  py: 1,
                  transition: theme.transitions.create("background-color"),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: theme.palette.text.secondary,
                    transition: theme.transitions.create("transform"),
                    "&:hover": { transform: "scale(1.1)" },
                  }}
                >
                  <PersonOutlined />
                </ListItemIcon>
                <ListItemText
                  primary="Login"
                  primaryTypographyProps={{
                    variant: "body2",
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>

              <ListItemButton
                component={Link}
                to="/user/register"
                state={{ path: pathname }}
                sx={{
                  borderRadius: 2,
                  my: 0.5,
                  px: 1.5,
                  py: 1,
                  bgcolor: theme.palette.primary.main,
                  color: "white",
                  transition: theme.transitions.create([
                    "background-color",
                    "box-shadow",
                  ]),
                  "&:hover": {
                    bgcolor: theme.palette.primary.dark,
                    boxShadow: theme.shadows[4],
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: "inherit",
                    transition: theme.transitions.create("transform"),
                    "&:hover": { transform: "scale(1.1)" },
                  }}
                >
                  <PersonOutlined />
                </ListItemIcon>
                <ListItemText
                  primary="Sign Up"
                  primaryTypographyProps={{
                    variant: "body2",
                    fontWeight: 600,
                  }}
                />
              </ListItemButton>
            </List>
          </>
        )}
      </Box>
    </Drawer>
  );
}

export default Sidebar;
