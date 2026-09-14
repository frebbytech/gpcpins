import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  LocalOffer,
  Bolt,
  ReceiptLong,
  Person,
  PersonOutlined,
} from "@mui/icons-material";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useAuth } from "../../context/providers/AuthProvider";

// Navigation items configuration
const navItems = [
  {
    label: "Home",
    icon: Home,
    path: "/",
    matchPattern: "/",
    hideOnMobile: true,
  },
  {
    label: "Checkers/Tickets",
    icon: LocalOffer,
    path: "/evoucher",
    matchPattern: "/evoucher",
  },
  {
    label: "Prepaid/Postpaid",
    icon: Bolt,
    path: "/electricity",
    matchPattern: "/electricity",
  },
  {
    label: "Airtime/Bundle",
    icon: ReceiptLong,
    path: "/airtime",
    matchPattern: "/airtime",
  },
];

function BottomNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  // Detect if screen size matches your "smaller screen" threshold (e.g., mobile view 'xs')
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Conditional user item (Profile or Sign up)
  const userItem = user?.id
    ? {
        label: "Profile",
        icon: PersonOutlined,
        path: "/profile",
        matchPattern: "/profile",
        hideOnMobile: true,
      }
    : {
        label: "Sign up",
        icon: Person,
        path: "/user/register",
        matchPattern: "/user/register",
        hideOnMobile: true,
      };

  // Combine items and filter out the ones marked to hide on mobile view
  const visibleItems = useMemo(() => {
    const combined = [...navItems, userItem];
    return isMobile ? combined.filter((item) => !item.hideOnMobile) : combined;
  }, [isMobile, userItem]);

  // Determine which item is active based on the visible list
  const activeIndex = useMemo(() => {
    const index = visibleItems.findIndex(
      (item) => location.pathname === item.path,
    );
    return index !== -1 ? index : 0;
  }, [location.pathname, visibleItems]);

  // Handle navigation
  const handleNavigate = (path) => {
    navigate(path, { replace: true });
  };

  // Active color from theme
  const activeColor = theme.palette.primary.main;
  const inactiveColor = theme.palette.text.secondary;

  return (
    <Paper
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderRadius: 0,
        borderTopLeftRadius: theme.shape.borderRadius,
        borderTopRightRadius: theme.shape.borderRadius,
      }}
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={activeIndex}
        onChange={(_, newValue) => handleNavigate(visibleItems[newValue].path)}
        sx={{
          height: 65,
          "& .MuiBottomNavigationAction-root": {
            minWidth: "auto",
            px: 1,
          },
          "& .Mui-selected": {
            color: activeColor,
          },
        }}
      >
        {visibleItems.map((item, index) => {
          const isActive = index === activeIndex;
          const IconComponent = item.icon;
          return (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={<IconComponent sx={{ fontSize: "1.15rem" }} />}
              onClick={() => handleNavigate(item.path)}
              sx={{
                fontSize: "0.75rem",
                color: isActive ? activeColor : inactiveColor,
                "&.Mui-selected": {
                  color: activeColor,
                },
              }}
              aria-current={isActive ? "page" : undefined}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}

export default BottomNav;
