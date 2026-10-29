import { useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Drawer,
  Divider,
  IconButton,
  List,
  Stack,
  Typography,
  Badge,
  Avatar,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Swal from "sweetalert2";
import { Link, useLocation } from "react-router-dom";
import {
  Menu as MenuIcon,
  ChevronLeft,
  ExitToAppRounded,
  Person,
  SettingsRounded,
  NotificationsRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/providers/AuthProvider";
import { CustomContext } from "@/context/providers/CustomProvider";
import { getAllNotifications } from "@/api/notificationAPI";
import { mainNav, canView } from "./navConfig";
import SidebarLink from "./SidebarLink";
import SidebarGroup from "./SidebarGroup";

export const SIDEBAR_EXPANDED_WIDTH = 264;
export const SIDEBAR_COLLAPSED_WIDTH = 78;
const MOBILE_WIDTH = 288;

function NotificationsIcon(props) {
  return props.badgeContent > 0 ? (
    <Badge badgeContent={props.badgeContent} color="error" overlap="circular">
      <NotificationsRounded sx={props.sx} />
    </Badge>
  ) : (
    <NotificationsRounded sx={props.sx} />
  );
}

function MainSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const {
    customState: { openSidebar },
    customDispatch,
  } = useContext(CustomContext);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });

  useEffect(() => {
    window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const closeMobile = () => customDispatch({ type: "openSidebar", payload: false });
  // const openMobile = () => customDispatch({ type: "openSidebar", payload: true });

  useEffect(() => {
    if (location.pathname) closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getAllNotifications(),
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    initialData: () => queryClient?.getQueryData(["notifications"]),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const unreadCount = useMemo(
    () => notifications?.data?.filter((n) => n?.active === 1)?.length ?? 0,
    [notifications.data]
  );

  const handleLogOut = () => {
    Swal.fire({
      title: "Logging out",
      text: "Do you want to log out?",
      showCancelButton: true,
    }).then(async ({ isConfirmed }) => {
      if (isConfirmed) logout();
    });
  };

  const visibleNav = useMemo(() => {
    return mainNav
      .map((item) => {
        if (item.type === "group") {
          const children = item.children.filter((c) => canView(c, user));
          if (!children.length || !canView(item, user)) return null;
          return { ...item, children };
        }
        return canView(item, user) ? item : null;
      })
      .filter(Boolean);
  }, [user]);

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  const renderNav = (isCollapsed, onNavigate) => (
    <List sx={{ px: 0.5, py: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
      {visibleNav.map((item) =>
        item.type === "group" ? (
          <SidebarGroup
            key={item.title}
            title={item.title}
            icon={item.icon}
            collapsed={isCollapsed}
            onNavigate={onNavigate}
          >
            {item.children}
          </SidebarGroup>
        ) : (
          <SidebarLink
            key={item.to}
            to={item.to}
            title={item.title}
            icon={item.icon}
            collapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        )
      )}
    </List>
  );

  const renderFooterNav = (isCollapsed, onNavigate) => (
    <List sx={{ px: 0.5, py: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
      <SidebarLink to="profile" title="Profile" icon={Person} collapsed={isCollapsed} onNavigate={onNavigate} />
      <SidebarLink
        to="notifications"
        title="Notifications"
        icon={(p) => <NotificationsIcon {...p} badgeContent={unreadCount} />}
        collapsed={isCollapsed}
        onNavigate={onNavigate}
      />
      {user?.permissions?.includes("Settings") && (
     <>
        <SidebarLink
          to="settings"
          title="Settings"
          icon={SettingsRounded}
          collapsed={isCollapsed}
          onNavigate={onNavigate}
        />

        
     
     
     </>
      )}
    </List>
  );

  const SidebarShell = ({ isCollapsed, isMobile, onNavigate }) => (
    <Stack
      sx={{
        height: "100%",
        width: "100%",
        bgcolor: theme.palette.primary.main,
        backgroundImage: `linear-gradient(180deg, ${alpha("#fff", 0.03)}, transparent 220px)`,
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={isCollapsed && !isMobile ? "center" : "space-between"}
        sx={{ px: isCollapsed && !isMobile ? 1 : 2, py: 2, minHeight: 64, flexShrink: 0 }}
      >
        {(!isCollapsed || isMobile) && (
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: "10px",
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(theme.palette.secondary.main, 0.18),
                color: theme.palette.secondary.main,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              GPC
            </Box>
            <Typography noWrap sx={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>
              GPC Console
            </Typography>
          </Stack>
        )}
        <IconButton
          size="small"
          onClick={isMobile ? closeMobile : () => setCollapsed((c) => !c)}
          sx={{
            color: alpha("#fff", 0.7),
            flexShrink: 0,
            "&:hover": { color: "#fff", bgcolor: alpha("#fff", 0.08) },
          }}
        >
          {isMobile ? (
            <ChevronLeft fontSize="small" />
          ) : collapsed ? (
            <MenuIcon fontSize="small" />
          ) : (
            <ChevronLeft fontSize="small" />
          )}
        </IconButton>
      </Stack>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* Nav */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { bgcolor: alpha("#fff", 0.15), borderRadius: 1.2 },
        }}
      >
        {user?.id ? (
          renderNav(isCollapsed && !isMobile, onNavigate)
        ) : (
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Link to="/user/login" style={{ color: "#fff", textDecoration: "none", fontSize: 13 }}>
              Login
            </Link>
            <Link
              to="/user/register"
              style={{
                backgroundColor: "#fff",
                color: theme.palette.primary.main,
                textDecoration: "none",
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              Sign up
            </Link>
          </Stack>
        )}
      </Box>

      {user?.id && (
        <>
          <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />
          {renderFooterNav(isCollapsed && !isMobile, onNavigate)}
          <Divider sx={{ borderColor: alpha("#fff", 0.08), mx: 1.5 }} />

          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={handleLogOut}
            sx={{
              mx: 1,
              my: 1,
              px: isCollapsed && !isMobile ? 1.25 : 1.5,
              py: 1,
              borderRadius: 1.2,
              cursor: "pointer",
              justifyContent: isCollapsed && !isMobile ? "center" : "flex-start",
              color: alpha("#fff", 0.75),
              "&:hover": { bgcolor: alpha("#fff", 0.06), color: "#fff" },
            }}
          >
            <Avatar
              sx={{
                width: 26,
                height: 26,
                fontSize: 12,
                flexShrink: 0,
                bgcolor: alpha(theme.palette.secondary.main, 0.25),
                color: theme.palette.secondary.main,
              }}
            >
              {userInitial}
            </Avatar>
            {(!isCollapsed || isMobile) && (
              <>
                <Stack sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>
                    {user?.name || user?.email || "Account"}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 11, color: alpha("#fff", 0.55) }}>
                    Log out
                  </Typography>
                </Stack>
                <ExitToAppRounded sx={{ fontSize: 18, flexShrink: 0 }} />
              </>
            )}
          </Stack>

          {(!isCollapsed || isMobile) && (
            <Typography variant="caption" textAlign="center" sx={{ color: alpha("#fff", 0.35), pb: 1.5 }}>
              &copy; {new Date().getFullYear()} GPC
            </Typography>
          )}
        </>
      )}
    </Stack>
  );

  return (
    <>
      {/* Mobile floating trigger — hidden while the drawer is open */}
      {/* {!openSidebar && (
        <IconButton
          onClick={openMobile}
          size="small"
          sx={{
            display: { xs: "inline-flex", md: "none" },
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 1250,
            bgcolor: theme.palette.primary.main,
            color: "#fff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            "&:hover": { bgcolor: theme.palette.primary.main },
          }}
        >
          <MenuIcon fontSize="small" />
        </IconButton>
      )} */}

      {/* Desktop rail — in normal flex flow, so Layout doesn't need to know its width */}
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
          flexShrink: 0,
          height: "100svh",
          position: "sticky",
          top: 0,
          transition: "width .25s ease",
          zIndex: 10,
        }}
      >
        <SidebarShell isCollapsed={collapsed} isMobile={false} />
      </Box>

      {/* Mobile drawer */}
      <Drawer
        open={openSidebar}
        onClose={closeMobile}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: MOBILE_WIDTH,
            boxSizing: "border-box",
            border: "none",
          },
        }}
      >
        <SidebarShell isCollapsed={false} isMobile onNavigate={closeMobile} />
      </Drawer>
    </>
  );
}

export default MainSidebar;
