import { useState, useMemo } from "react";
import {
  Box,
  Stack,
  Typography,
  Tooltip,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Badge,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Search as SearchIcon,
  MarkChatRead as MarkChatReadIcon,
  DeleteSweep as DeleteSweepIcon,
  NotificationsOff as NotificationsOffIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UnreadIcon,
} from "@mui/icons-material";
import DOMPurify from "dompurify";
import moment from "moment";
import Swal from "sweetalert2";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCustomContext,
} from "@/context/providers/CustomProvider";
import {  useAuth } from "@/context/providers/AuthProvider";
import {
  getAllNotifications,
  markAllNotificationsAsRead,
  deleteNotifications,
} from "@/api/notificationAPI";
import AnimatedContainer from "@/components/animations/AnimatedContainer";
import GlobalSpinner from "@/components/spinners/GlobalSpinner";
import { globalAlertType } from "@/components/alert/alertType";

const Notifications = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { customDispatch } = useCustomContext();
  const queryClient = useQueryClient();

  // --- UI state ---
  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState(0); // 0: All, 1: Unread, 2: Read

  // --- Fetch notifications ---
  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["notifications",user?.id],
    queryFn: () => getAllNotifications(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // --- Mark all as read mutation ---
  const markReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      customDispatch(
        globalAlertType("success", "All notifications marked as read"),
      );
      queryClient.invalidateQueries({ queryKey: ["notifications",user?.id] });
    },
    onError: (err) => {
      customDispatch(
        globalAlertType("error", err.message || "Failed to mark as read"),
      );
    },
  });

  // --- Delete all notifications mutation ---
  const deleteAllMutation = useMutation({
    mutationFn: deleteNotifications,
    onSuccess: () => {
      customDispatch(globalAlertType("info", "All notifications deleted"));
      queryClient.invalidateQueries({ queryKey: ["notifications",user?.id] });
    },
    onError: (err) => {
      customDispatch(
        globalAlertType(
          "error",
          err.message || "Failed to delete notifications",
        ),
      );
    },
  });

  // --- Derived data ---
  const unreadCount = notifications.filter(
    (item) => item?.isRead === false,
  ).length;

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Filter by tab
    if (tabValue === 1)
      filtered = filtered.filter((item) => item?.isRead === false);
    if (tabValue === 2)
      filtered = filtered.filter((item) => item?.isRead === true);

    // Filter by search term (title or message)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title?.toLowerCase().includes(term) ||
          n.message?.toLowerCase().includes(term),
      );
    }

    return filtered;
  }, [notifications, tabValue, searchTerm]);

  // --- Handlers ---
  const handleMarkAllRead = () => {
    if (unreadCount === 0) {
      customDispatch(globalAlertType("info", "No unread notifications"));
      return;
    }
    Swal.fire({
      title: "Mark all as read?",
      text: `You have ${unreadCount} unread notification(s).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: theme.palette.primary.main,
    }).then((result) => {
      if (result.isConfirmed) markReadMutation.mutate();
    });
  };

  const handleDeleteAll = () => {
    if (notifications.length === 0) return;
    Swal.fire({
      title: "Delete all notifications?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: theme.palette.error.main,
      confirmButtonText: "Yes, delete all",
    }).then((result) => {
      if (result.isConfirmed) deleteAllMutation.mutate();
    });
  };

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <AnimatedContainer>
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </AnimatedContainer>
    );
  }

  if (isError) {
    return (
      <AnimatedContainer>
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography color="error">
            Failed to load notifications: {error?.message}
          </Typography>
        </Box>
      </AnimatedContainer>
    );
  }

  return (
    <AnimatedContainer>
      <Box sx={{ mx: "auto", p: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={600}>
              Notifications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stay updated with your latest activities
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Mark all as read">
              <span>
                <IconButton
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0 || markReadMutation.isPending}
                  color="primary"
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                >
                  <MarkChatReadIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete all">
              <span>
                <IconButton
                  onClick={handleDeleteAll}
                  disabled={
                    notifications.length === 0 || deleteAllMutation.isPending
                  }
                  color="error"
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}
                >
                  <DeleteSweepIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Search & Tabs */}
        <Card variant="outlined" sx={{ mb: 3, p: 2, borderRadius: 3 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              placeholder="Search by title or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
              size="small"
            />
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue)}
              variant="fullWidth"
              sx={{
                "& .MuiTab-root": { textTransform: "none", fontWeight: 500 },
              }}
            >
              <Tab
                label={
                  <Badge
                    badgeContent={notifications.length}
                    color="primary"
                    sx={{ "& .MuiBadge-badge": { right: -20 } }}
                  >
                    All
                  </Badge>
                }
              />
              <Tab
                label={
                  <Badge badgeContent={unreadCount} color="error">
                    Unread
                  </Badge>
                }
              />
              <Tab label="Read" />
            </Tabs>
          </Stack>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card sx={{ p: 6, textAlign: "center", borderRadius: 3 }}>
            <NotificationsOffIcon
              sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary">
              No notifications found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm
                ? "Try adjusting your search or filter"
                : "You're all caught up!"}
            </Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {filteredNotifications.map((notif) => (
              <NotificationCard key={notif._id} notification={notif} />
            ))}
          </Stack>
        )}
      </Box>

      {/* Loading overlays for mutations */}
      {(markReadMutation.isPending || deleteAllMutation.isPending) && (
        <GlobalSpinner />
      )}
    </AnimatedContainer>
  );
};

// --- Individual Notification Card Component ---
const NotificationCard = ({ notification }) => {
  const theme = useTheme();
  const isUnread = notification.active === 1;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        transition: "all 0.2s",
        bgcolor: isUnread
          ? alpha(theme.palette.warning.light, 0.08)
          : "background.paper",
        borderLeft: isUnread
          ? `4px solid ${theme.palette.warning.main}`
          : "none",
        "&:hover": {
          boxShadow: theme.shadows[2],
          bgcolor: alpha(theme.palette.primary.light, 0.02),
        },
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1}
        >
          <Box sx={{ flex: 1 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap="wrap"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                {notification.title}
              </Typography>
              {isUnread && (
                <Chip
                  label="Unread"
                  size="small"
                  color="warning"
                  icon={<UnreadIcon sx={{ fontSize: 16 }} />}
                  sx={{ height: 24, fontSize: "0.7rem" }}
                />
              )}
            </Stack>

            {/* Message content */}
            {notification.type === "Email" ? (
              <Box
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(notification.body),
                }}
                sx={{
                  "& p, & div": { mb: 1, fontSize: "0.9rem" },
                  "& img": { maxWidth: "100%" },
                }}
              />
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                {notification.body}
              </Typography>
            )}

            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              {moment(notification.createdAt).fromNow()}
            </Typography>
          </Box>
          {isUnread && (
            <Tooltip title="Mark as read">
              <IconButton size="small" sx={{ mt: -0.5 }}>
                <CheckCircleIcon fontSize="small" color="disabled" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default Notifications;
