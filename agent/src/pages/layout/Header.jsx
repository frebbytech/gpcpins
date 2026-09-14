
import { useState, useEffect } from "react";
import {
  AppBar,
  IconButton,
  Typography,
  Stack,
  Divider,
  Avatar,
  useTheme,
  Badge,
  Container,
  MenuItem,
  Tooltip,
  Button,
  Skeleton,
} from "@mui/material";
import { NotificationsSharp, WalletRounded } from "@mui/icons-material";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Swal from "sweetalert2";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IMAGES, currencyFormatter } from "@/constants";
import { useCustomContext } from "@/context/providers/CustomProvider";
import { getInitials } from "@/config/validation";
import NotificationDropdown from "@/components/dropdowns/NotificationDropdown";
import { useAuth } from "@/context/providers/AuthProvider";
import ActionMenu from "@/components/menu/ActionMenu";
import { getWalletBalance } from "@/api/agentAPI";
import { getAllNotifications } from "@/api/notificationAPI";

const ITEM_HEIGHT = 48;
function Header() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const {
    customState: { openSidebar },
    customDispatch,
  } = useCustomContext();

  const {
    palette,
    typography: { button },
  } = useTheme();

  const [photo, setPhoto] = useState(null);
  const [shadow, setShadow] = useState("none");
  const [anchorEl, setAnchorEl] = useState(null);
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);
  const navigate = useNavigate();

  const walletBalance = useQuery({
    queryKey: ["wallet-balance", user?.id],
    queryFn: () => getWalletBalance(user?.id),
    enabled: !!user?.id,
    initialData: 0,
  });

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: getAllNotifications,
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    cacheTime: 1000 * 60 * 5,
    retry: 2,
    refetchOnWindowFocus: false,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const unReadNotifications = notifications?.data?.filter(
    (item) => item?.isRead === false,
  );

  useEffect(() => {
    setPhoto(user?.profile);
  }, [user]);

  const open = Boolean(anchorEl);

  // const handleClick = (event) => {
  //   setAnchorEl(event.currentTarget);
  // };
  const handleClose = () => {
    setAnchorEl(null);
  };

  window.onscroll = function () {
    if (window.scrollY > 5) {
      setShadow("2px 3px 5px rgba(0,0,0,0.15)");
    } else {
      setShadow("none");
    }
  };

  const toggleSideBar = () =>
    customDispatch({
      type: "openSidebar",
      payload: !openSidebar,
    });

  const goHome = () => navigate("/", { replace: true });

  const toggleNotification = () => {
    setShowNotificationDropdown(!showNotificationDropdown);
  };

  const myLinkStyles = ({ isActive }) => {
    return {
      fontFamily: button.fontFamily,
      fontSize: button.fontSize,
      // position: 'relative',
      textDecoration: "none",
      borderBottom: isActive ? `solid 1px ${palette.primary.main}` : null,
      color: isActive ? palette.primary.main : "#333",

      fontWeight: isActive ? "bold" : "400",
    };
  };

  const handleLogOut = () => {
    Swal.fire({
      title: "Logging out",
      text: `Do you want to log out?`,
      showCancelButton: true,
    }).then(async ({ isConfirmed }) => {
      if (isConfirmed) {
        logout();
      }
    });
  };

  return (
    <AppBar
      elevation={0}
      sx={{
        position: "sticky",
        top: 0,
        color: "primary",
        backgroundColor: "#fff",
        borderBottom: "1px solid #ccc",
        zIndex: 999,
        boxShadow: shadow,
        width: "100%",
      }}
      color="inherit"
    >
      <Container
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          justifyContent="center"
          alignItems="center"
        >
          <Avatar
            alt="logo"
            src={IMAGES.logo}
            sx={{
              width: 60,
              height: 60,
              cursor: "pointer",
            }}
            onClick={goHome}
          />

          <Typography
            variant="h6"
            sx={{
              display: { xs: "none", md: "inline-flex" },
              cursor: "pointer",
              pl: 1,
            }}
            onClick={goHome}
          >
            Gab Powerful Consult
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2} sx="flex" alignItems="center">
          <>
            {user?.id ? (
              <>
                {walletBalance.isLoading ? (
                  <Skeleton variant="rounded" width={80} height={40} />
                ) : (
                  <Tooltip title="Wallet Balance">
                    <Link to="/wallet?_pid=3aa994d1-0474-4be6-9893-acae1ee9f858">
                      <Button variant="text" startIcon={<WalletRounded />}>
                        {currencyFormatter(walletBalance.data)}
                      </Button>
                    </Link>
                  </Tooltip>
                )}

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ display: { xs: "none", md: "flex" } }}
                  alignItems="center"
                >
                  <div style={{ position: "relative" }}>
                    <Tooltip title="Notifications">
                      <IconButton onClick={toggleNotification}>
                        <Badge
                          badgeContent={unReadNotifications?.length}
                          color="error"
                        >
                          <NotificationsSharp />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <NotificationDropdown
                      display={showNotificationDropdown}
                      setClose={setShowNotificationDropdown}
                    />
                  </div>

                  <ActionMenu
                    icon={
                      <Tooltip title="Profile">
                        <Avatar
                          sx={{ bgcolor: "primary.main", cursor: "pointer" }}
                          src={photo}
                          alt="profile_icon"
                        >
                          {getInitials(user?.email)}
                        </Avatar>
                      </Tooltip>
                    }
                  >
                    <MenuItem>
                      <Link
                        to="/profile"
                        style={{
                          textAlign: "center",
                          display: "block",
                          textDecoration: "none",
                          color: "#fff",
                        }}
                      >
                        Profile
                      </Link>
                    </MenuItem>

                    <Divider />
                    <MenuItem onClick={handleLogOut}>Log out</MenuItem>
                  </ActionMenu>
                </Stack>
              </>
            ) : (
              <>
                <NavLink
                  to="/auth/login"
                  state={{ path: pathname }}
                  className="nav-item"
                  style={myLinkStyles}
                >
                  Log in
                </NavLink>
                <NavLink
                  to="/auth/register"
                  state={{ path: pathname }}
                  className="nav-item"
                  style={{
                    border: `1px solid ${palette.primary.main}`,
                    borderRadius: "8px",
                    color: palette.primary.main,
                  }}
                  end
                >
                  Sign up
                </NavLink>
              </>
            )}
          </>
        </Stack>

        <Menu
          id="account-menu"
          elevation={1}
          MenuListProps={{
            "aria-labelledby": "account-menu",
          }}
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          sx={{ p: 4 }}
          PaperProps={{
            style: {
              maxHeight: ITEM_HEIGHT * 4.5,
              fontSize: "14px !important",
            },
          }}
        ></Menu>

        <IconButton
          color="inherit"
          onClick={toggleSideBar}
          sx={{
            display: { xs: "block", md: "none" },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Container>
    </AppBar>
  );
}

export default Header;
