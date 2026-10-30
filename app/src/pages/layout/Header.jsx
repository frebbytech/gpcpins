import { useState, useLayoutEffect, useEffect } from "react";
import {
  AppBar,
  IconButton,
  Stack,
  Divider,
  Avatar,
  useTheme,
  Badge,
  Box,
  Container,
  Button,
  Tooltip,
  Alert,
  alpha,
  Fade,
} from "@mui/material";
import {
  NotificationsSharp,
  WalletRounded,
  SearchRounded,
  Close,
  Menu as MenuIcon,
} from "@mui/icons-material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Swal from "sweetalert2";
import { Link, NavLink, useLocation } from "react-router-dom";
import { currencyFormatter } from "@/constants";
import { getInitials } from "@/config/validation";
import NotificationDropdown from "@/components/dropdowns/NotificationDropdown";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { useAuth } from "../../context/providers/AuthProvider";
import Navbar from "../../components/dropdowns/Navbar";

function Header() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [showAlert, setShowAlert] = useState(() => {
    const closed = sessionStorage.getItem("announcementClosed") === "true";
    return !closed;
  });

  const { pathname } = useLocation();
  const {
    customState: { openSidebar, globalAlert },
    customDispatch,
    walletBalance,
  } = useCustomContext();

  const theme = useTheme();

  const [shadow, setShadow] = useState("none");
  const [scrolled, setScrolled] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);

  const notifs = queryClient.getQueryData({
    queryKey: ["notifications", user?.id],
  });

  const unReadNotifications = notifs?.filter(
    (item) => item?.active && !item.isRead,
  );

  useLayoutEffect(() => {
    if (user?.id && !user?.phonenumber) {
      customDispatch({
        type: "setGlobalAlert",
        payload: {
          open: true,
          severity: "info",
          message: "incomplete-profile",
        },
      });
    }
  }, [user, customDispatch]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShadow(scrollY > 5 ? theme.shadows[2] : "none");
      setScrolled(scrollY >= 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [theme.shadows]);

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const toggleSideBar = () =>
    customDispatch({
      type: "openSidebar",
      payload: !openSidebar,
    });

  const toggleNotification = () => {
    setShowNotificationDropdown(!showNotificationDropdown);
  };

  const closeGlobalAlert = () => {
    customDispatch({
      type: "setGlobalAlert",
      payload: { open: false },
    });
  };

  const myLinkStyles = ({ isActive }) => ({
    fontFamily: theme.typography.button.fontFamily,
    fontSize: theme.typography.button.fontSize,
    fontWeight: isActive ? 600 : 500,
    textDecoration: "none",
    color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
    borderBottom: isActive
      ? `2px solid ${theme.palette.primary.main}`
      : "2px solid transparent",
    paddingBottom: "4px",
    transition: theme.transitions.create(["color", "border-bottom-color"], {
      duration: theme.transitions.duration.short,
    }),
    "&:hover": {
      color: theme.palette.primary.main,
      borderBottomColor: alpha(theme.palette.primary.main, 0.4),
    },
  });

  const handleLogOut = () => {
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

  const handleOpenSearch = () => {
    customDispatch({ type: "openSearch", payload: true });
  };

  // const getLocation = () => {
  //   const position = [6.70675631287526, -1.6189752122036272];
  //   const destination = `${position[0]},${position[1]}`;
  //   const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  //   window.open(googleMapsUrl, "_blank");
  // };

  const dismissAnnouncement = () => {
    setShowAlert(false);
    sessionStorage.setItem("announcementClosed", "true");
  };

  return (
    <>
      {/* Announcement bar */}
      <Fade in={showAlert} timeout={800}>
        <Box
          sx={{
            display: showAlert ? "flex" : "none",
            alignItems: "center",
            justifyContent: "space-between",
            gap: { xs: 1, sm: 2 },
            py: 1,
            px: 4,
            fontSize: { xs: "0.75rem", sm: "0.875rem" },
            color: theme.palette.text.secondary,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "nowrap",
            }}
          >
            <span style={{marginRight:'5px'}}>Download our free mobile apps</span>
            <Button
              component={Link}
              to="/downloads"
              size="small"
              variant="contained"
              sx={{
                minWidth: "auto",
                py: 0.25,
                px: 1.5,
                fontSize: { xs: "0.65rem", sm: "0.75rem" },
                borderRadius: 1.5,
                boxShadow: "none",
                "&:hover": {
                  boxShadow: theme.shadows[2],
                },
              }}
            >
              Download
            </Button>
          </Box>
          <IconButton
            size="small"
            onClick={dismissAnnouncement}
            sx={{
              transition: theme.transitions.create([
                "background-color",
                "transform",
              ]),
              "&:hover": {
                bgcolor: alpha(theme.palette.grey[500], 0.1),
                transform: "scale(1.1)",
              },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Fade>


      <AppBar
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          zIndex: 1200,
          boxShadow: shadow,
          transition: theme.transitions.create("box-shadow"),
        }}
        color="inherit"
      >
        <Container maxWidth="xl" sx={{ py: 1 }}>
          {/* Main header row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            {/* Left side: menu icon + mobile wallet info */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: { xs: "100%", md: "auto" },
                flexGrow:{sm:1,lg:0}
              }}
            >
              <Box sx={{ flexGrow: 1, flex: 1 }}>
                <IconButton
                  onClick={toggleSideBar}
                  sx={{
                    transition: theme.transitions.create("transform"),
                    "&:hover": { transform: "scale(1.1)" },
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </Box>
              {/* {user?.id && (
                <Box
                  sx={{
                    display: { xs: "flex", md: "none" },
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Tooltip title="Wallet Balance">
                    <Button
                      component={Link}
                      to="/wallet?_pid=1"
                      size="small"
                      variant="outlined"
                      startIcon={<WalletRounded />}
                      sx={{
                        fontSize: 12,
                        borderRadius: 1,
                      }}
                    >
                      {currencyFormatter(walletBalance || 0)}
                    </Button>
                  </Tooltip>
                </Box>
              )} */}
            </Box>

            <Navbar />
           <Tooltip title="Search transactions">
              <IconButton
                onClick={handleOpenSearch}
                sx={{
                  bgcolor: alpha(theme.palette.grey[500], 0.1),
                  transition: theme.transitions.create([
                    "background-color",
                    "transform",
                  ]),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    transform: "scale(1.1)",
                  },
                }}
              >
                <SearchRounded />
              </IconButton>
            </Tooltip>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ display: { xs: "none", md: "flex" } }}
            >
              
              {user?.id ? (
                <>
                  {/* <Tooltip title="Wallet Balance">
                    <Button
                      component={Link}
                      to="/wallet?_pid=1"
                      variant="outlined"
                      color="primary"
                      startIcon={<WalletRounded />}
                      sx={{
                        fontSize: 12,
                        borderRadius: 1,
                      }}
                    >
                      {currencyFormatter(walletBalance || 0)}
                    </Button>
                  </Tooltip> */}

                  <Box sx={{ position: "relative" }}>
                    <Tooltip title="Notifications">
                      <IconButton
                        onClick={toggleNotification}
                        sx={{
                          transition: theme.transitions.create("transform"),
                          "&:hover": { transform: "scale(1.1)" },
                        }}
                      >
                        <Badge
                          badgeContent={unReadNotifications?.length}
                          color="error"
                          sx={{
                            "& .MuiBadge-badge": {
                              animation: unReadNotifications?.length
                                ? "pulse 1.5s infinite"
                                : "none",
                            },
                          }}
                        >
                          <NotificationsSharp />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <NotificationDropdown
                      notifications={notifs}
                      open={showNotificationDropdown}
                      onClose={setShowNotificationDropdown}
                    />
                  </Box>

                  <Tooltip title="Profile">
                    <Avatar
                      sx={{
                        bgcolor: theme.palette.secondary.main,
                        cursor: "pointer",
                        transition: theme.transitions.create("transform"),
                        "&:hover": { transform: "scale(1.05)" },
                      }}
                      aria-controls={open ? "account-menu" : undefined}
                      aria-haspopup="true"
                      aria-expanded={open ? "true" : undefined}
                      onClick={handleClick}
                      src={user?.profile}
                      alt="profile"
                    >
                      {getInitials(user?.name || user?.email)}
                    </Avatar>
                  </Tooltip>
                </>
              ) : (
                <>
                  <NavLink
                    to="/user/login"
                    state={{ path: pathname, redirectURL: pathname }}
                    style={myLinkStyles}
                  >
                    Log in
                  </NavLink>
                  <Button
                    component={NavLink}
                    to="/user/register"
                    state={{ path: pathname, redirectURL: pathname }}
                    variant="contained"
                    size="small"
                    sx={{
                      borderRadius: 2,
                      boxShadow: "none",
                      "&:hover": {
                        boxShadow: theme.shadows[2],
                      },
                    }}
                  >
                    Sign up
                  </Button>
                </>
              )}
            </Stack>
             
          </Box>
        </Container>

        {/* Profile menu */}
        <Menu
          id="account-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          TransitionComponent={Fade}
          PaperProps={{
            elevation: 3,
            sx: {
              borderRadius: 2,
              mt: 1,
              minWidth: 150,
              "& .MuiMenuItem-root": {
                fontSize: "0.875rem",
                px: 2,
                py: 1,
                transition: theme.transitions.create("background-color"),
              },
            },
          }}
        >
          <MenuItem component={Link} to="/profile" onClick={handleClose}>
            Profile
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              handleClose();
              handleLogOut();
            }}
            sx={{ color: theme.palette.error.main }}
          >
            Log out
          </MenuItem>
        </Menu>

        {/* Global alert */}
        {globalAlert?.open && pathname !== "/profile" && (
          <Alert
            severity="info"
            sx={{
              fontSize: "0.875rem",
              borderRadius: 0,
              "& .MuiAlert-message": { width: "100%" },
            }}
            onClose={closeGlobalAlert}
          >
            {globalAlert?.message === "incomplete-profile" ? (
              <>
                Your profile is incomplete. Please complete it by clicking{" "}
                <Link
                  to="profile"
                  style={{ fontWeight: 600, textDecoration: "underline" }}
                >
                  here
                </Link>
                .
              </>
            ) : (
              globalAlert?.message
            )}
          </Alert>
        )}

      </AppBar>
    </>
  );
}

export default Header;
