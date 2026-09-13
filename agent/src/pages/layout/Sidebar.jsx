import { useEffect, useState } from "react";
import {
  Box,
  Divider,
  IconButton,
  List,
  Stack,
  Typography,
  useTheme,
  Tooltip,
  Badge,
} from "@mui/material";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import NavLinkItem from "../../components/NavLinkItem";
import NavLinkItemCollapse from "../../components/modals/NavLinkItemCollapse";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { Link, useLocation } from "react-router-dom";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import {
  DashboardRounded,
  ExitToAppRounded,
  CardMembership,
  DataObjectRounded,
  Person,
  BarChartRounded,
  Menu,
  WalletOutlined,
  WalletRounded,
  NotificationsRounded,
} from "@mui/icons-material";
import { useAuth } from "../../context/providers/AuthProvider";
import { useMemo } from "react";

function Sidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [toggleWidth, setToggleWidth] = useState(false);

  const { customDispatch, notifications } = useCustomContext();
  const { palette } = useTheme();
  const location = useLocation();

  // const notifications = useQuery({
  //   queryKey: ["notifications"],
  //   queryFn: () => getAllNotifications(),
  //   enabled: !!user?.id,
  //   refetchOnMount: false,
  //   refetchOnReconnect: false,
  //   refetchOnWindowFocus: false,
  //   initialData: queryClient?.getQueryData(["notifications"]),
  //       retry: 1,
  //       staleTime: 5 * 60 * 1000, // 5 minutes

  // });

  useEffect(() => {
    if (location.pathname) {
      customDispatch({
        type: "openSidebar",
        payload: false,
      });
    }
  }, [location, customDispatch]);

  const handleClose = () => {
    setToggleWidth(!toggleWidth);

    // customDispatch({
    //   type: 'openSidebar',
    //   payload: !openSidebar,
    // });
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

  const unReadNotifications = useMemo(
    () => notifications?.data?.filter((item) => item?.isRead === false),
    [notifications.data],
  );

  return (
    <Box
      sx={{
        height: "100svh",
        display: { xs: "none", md: "block" },
        pt: 2,
        transition: "all 0.4s ease-in-out",
        gap: 1,
        position: "sticky",
        top: 0,
        bgcolor: "primary.main",

        zIndex: 999,
      }}
    >
      <Box
        role="presentation"
        sx={{
          display: "flex",
          flexDirection: "column",
          // gridTemplateRows: 'auto 1fr auto',
          width: toggleWidth ? 55 : { xs: 0, md: 200, lg: 240 },
          gap: "1rem",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: toggleWidth ? "flex-start" : "space-between",
            alignItems: "center",
            px: toggleWidth ? 0 : 2,
          }}
        >
          <Typography
            sx={{ display: toggleWidth ? "none" : "inline-flex" }}
            color="secondary"
          >
            GPC
          </Typography>
          <IconButton edge="end" onClick={handleClose}>
            <Menu />
          </IconButton>
        </Box>
        <Divider flexItem />
        <Box className="sidebar" sx={{ overflowY: "scroll", height: "75svh" }}>
          {user?.id ? (
            <>
              <List>
                <NavLinkItem
                  to="/"
                  title="Dashboard"
                  icon={<DashboardRounded />}
                />

                <NavLinkItemCollapse
                  icon={<WalletOutlined htmlColor="#fff" />}
                  title={toggleWidth ? "" : "Services"}
                >
                  <NavLinkItem
                    to="airtime/transactions"
                    title="Sell Airtime"
                    icon={<CardMembership />}
                  />
                  <NavLinkItem
                    to="bundle/transactions"
                    title="Sell Data Bundle"
                    icon={<DataObjectRounded />}
                  />
                </NavLinkItemCollapse>

                <NavLinkItem
                  to="summary"
                  title="Summary & Report"
                  icon={<BarChartRounded />}
                />
              </List>
              <Divider flexItem />
              <List>
                <NavLinkItem to="profile" title="Profile" icon={<Person />} />
                <NavLinkItem
                  to="notifications"
                  title="Notifications"
                  icon={
                    <Badge
                      badgeContent={unReadNotifications?.length}
                      color="error"
                    >
                      <NotificationsRounded />
                    </Badge>
                  }
                />
                <NavLinkItem
                  to="wallet"
                  title="Wallet"
                  icon={<WalletRounded />}
                />
                <NavLinkItem
                  to="logs"
                  title="Activity Logs"
                  icon={<AccessTimeIcon />}
                />
                <Tooltip title="Log out" placement="right">
                  <Stack
                    direction="row"
                    spacing={3}
                    pl="8px"
                    pt={1}
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.1)",
                      },
                    }}
                    onClick={handleLogOut}
                  >
                    <ExitToAppRounded htmlColor="#fff" />

                    <Typography variant="button" color="#fff">
                      Log Out
                    </Typography>
                  </Stack>
                </Tooltip>
              </List>
            </>
          ) : (
            <>
              <List>
                <>
                  <Stack
                    columnGap={3}
                    sx={{
                      padding: 2,
                      cursor: "pointer",
                    }}
                    spacing={2}
                  >
                    <Link
                      to="/user/login"
                      state={{ path: pathname }}
                      className="nav-item"
                      style={{ color: "#fff" }}
                    >
                      Login
                    </Link>

                    <Link
                      to="/user/register"
                      state={{ path: pathname }}
                      className="nav-item"
                      style={{
                        backgroundColor: "#fff",
                        color: palette?.primary?.main,
                      }}
                    >
                      Sign up
                    </Link>
                  </Stack>
                </>
              </List>
            </>
          )}
        </Box>
        <Typography
          variant="body2"
          textAlign="center"
          color="secondary"
          paragraph
          pt={1}
          sx={{
            display: toggleWidth
              ? "none"
              : { xs: "block", md: "none", lg: "block" },
          }}
        >
          Copyright &copy; {new Date().getFullYear()} | GPC
        </Typography>
      </Box>
    </Box>
  );
}

export default Sidebar;

Sidebar.proptype = {
  openSidebar: PropTypes.bool,
  setOpenSidebar: PropTypes.func,
};
