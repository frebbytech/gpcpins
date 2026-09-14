import { useContext, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  alpha,
  useTheme,
  TextField
} from "@mui/material";
import {
  MarkChatRead as MarkChatReadIcon,
  DeleteSweep as DeleteSweepIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  NotificationsOutlined,
  NotificationsActiveOutlined,
  InboxOutlined,
  CheckCircleOutline,
  SearchOffOutlined,
  DoneAllOutlined,
  DeleteOutline,
  ScheduleOutlined,
  OpenInNewOutlined,
  ConfirmationNumberOutlined,
  RedeemOutlined,
  BoltOutlined,
  PhoneAndroidOutlined,
  WifiOutlined,
  AccountBalanceWalletOutlined,
  CampaignOutlined,
} from "@mui/icons-material";
import moment from "moment";
import DOMPurify from "dompurify";
import Swal from "sweetalert2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "../../context/providers/AuthProvider";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { globalAlertType } from "../../components/alert/alertType";
import AnimatedContainer from "../../components/animations/AnimatedContainer";
import GlobalSpinner from "../../components/GlobalSpinner";
import {
  changeNotificationStatus,
  getAllBroadcastMessages,
  removeNotification,
} from "../../api/broadcastMessageAPI";
import { Navigate } from "react-router-dom";

// ---- Category configuration (icon + accent color per category) ----
const CATEGORY_CONFIG = {
  ticket: { label: "Ticket", color: "#7c3aed", icon: ConfirmationNumberOutlined },
  voucher: { label: "Voucher", color: "#ea580c", icon: RedeemOutlined },
  prepaid: { label: "Prepaid", color: "#0284c7", icon: BoltOutlined },
  airtime: { label: "Airtime", color: "#16a34a", icon: PhoneAndroidOutlined },
  bundle: { label: "Bundle", color: "#db2777", icon: WifiOutlined },
  wallet: { label: "Wallet", color: "#d97706", icon: AccountBalanceWalletOutlined },
  general: { label: "General", color: "#64748b", icon: CampaignOutlined },
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

// Infer category from title (falls back to body, then "general")
const getCategory = (notif) => {
  const title = notif?.title?.toLowerCase() ?? "";
  const body = notif?.body?.toLowerCase() ?? "";
  const match = Object.keys(CATEGORY_CONFIG).find(
    (key) => key !== "general" && (title.includes(key) || body.includes(key))
  );
  return match ?? "general";
};

// ---- Body with expand/collapse for long content ----
function NotificationBody({ notif }) {
  const [expanded, setExpanded] = useState(false);
  const raw = notif?.body ?? "";
  const isLong = raw.length > 180;

  const clampSx = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: expanded ? "unset" : 3,
    overflow: "hidden",
  };

  if (notif?.type === "Email") {
    return (
      <Box>
        <Box
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(raw) }}
          sx={{
            ...clampSx,
            "& p": { m: 0, fontSize: "0.875rem" },
            "& a": { color: "primary.main" },
          }}
        />
        {isLong && (
          <Button
            size="small"
            onClick={() => setExpanded((e) => !e)}
            sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 600 }}
          >
            {expanded ? "Show less" : "Show more"}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ ...clampSx, wordBreak: "break-word" }}
      >
        {raw || "No content"}
      </Typography>
      {isLong && (
        <Button
          size="small"
          onClick={() => setExpanded((e) => !e)}
          sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 600 }}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </Box>
  );
}

// ---- Notification card ----
function NotificationItem({ notif, index, onMarkRead, onDelete, isBusy }) {
  const theme = useTheme();
  const isUnread = notif?.isRead === false;
  const { icon: CatIcon, color: catColor, label: catLabel } =
    CATEGORY_CONFIG[getCategory(notif)];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 1.2,
        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        borderLeft: `4px solid ${
          isUnread ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)
        }`,
        bgcolor: isUnread
          ? alpha(theme.palette.primary.main, 0.03)
          : "background.paper",
        transition: "box-shadow .2s ease, background-color .2s ease",
        "&:hover": {
          boxShadow: theme.shadows[2],
          "& .item-actions": { opacity: { xs: 1, sm: 1 } },
        },
        animation: `cardIn .35s ease ${Math.min(index, 10) * 0.05}s both`,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* Category avatar */}
        <Avatar
          variant="rounded"
          sx={{
            bgcolor: alpha(catColor, 0.12),
            color: catColor,
            width: 42,
            height: 42,
            borderRadius: 2,
            mt: 0.25,
            flexShrink: 0,
          }}
        >
          <CatIcon fontSize="small" />
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 0.5, flexWrap: "wrap", rowGap: 0.5 }}
          >
            {isUnread && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  flexShrink: 0,
                  animation: "pulse 2s infinite",
                }}
              />
            )}
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: isUnread ? 800 : 600,
                fontSize: "0.95rem",
                minWidth: 0,
              }}
            >
              {notif?.title || "Notification"}
            </Typography>
            <Chip
              label={catLabel}
              size="small"
              sx={{
                ml: "auto",
                height: 20,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                bgcolor: alpha(catColor, 0.1),
                color: catColor,
              }}
            />
          </Stack>

          {/* Body */}
          <NotificationBody notif={notif} />

          {notif?.link && (
            <Button
              href={notif.link}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              startIcon={<OpenInNewOutlined />}
              sx={{
                mt: 0.5,
                p: 0,
                minWidth: 0,
                textTransform: "none",
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              Open attachment
            </Button>
          )}

          {/* Footer row: timestamp + per-item actions */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 1 }}
          >
            <Tooltip title={moment(notif?.createdAt).format("LLLL")}>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ color: "text.disabled" }}
              >
                <ScheduleOutlined sx={{ fontSize: 14 }} />
                <Typography variant="caption">
                  {moment(notif?.createdAt).fromNow()}
                </Typography>
              </Stack>
            </Tooltip>

            <Stack
              className="item-actions"
              direction="row"
              sx={{ opacity: { xs: 1, sm: 0.35 }, transition: "opacity .2s" }}
            >
              {isUnread && (
                <Tooltip title="Mark as read">
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={isBusy}
                    onClick={onMarkRead}
                  >
                    <DoneAllOutlined sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  disabled={isBusy}
                  onClick={onDelete}
                >
                  <DeleteOutline sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

// ---- Empty state ----
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
      <Avatar
        sx={{
          width: 88,
          height: 88,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          color: "text.disabled",
          mb: 2,
        }}
      >
        {icon}
      </Avatar>
      <Typography variant="h6" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {subtitle}
      </Typography>
      {action && (
        <Button variant="outlined" size="small" onClick={action} sx={{ mt: 2, textTransform: "none", fontWeight: 600, borderRadius: 2 }}>
          Clear filters
        </Button>
      )}
    </Stack>
  );
}

// ---- Stat card ----
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        flex: 1,
        minWidth: 130,
        borderRadius: 1.2,
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.6)}`,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Avatar
        sx={{ bgcolor: alpha(color, 0.12), color, borderRadius: 2, width: 42, height: 42 }}
      >
        <Icon fontSize="small" />
      </Avatar>
      <Box>
        <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

const Notifications = () => {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const { notifications: notifs, customDispatch } = useCustomContext();
  const queryClient = useQueryClient();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all"); // "all" | "unread"

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch notifications
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    error: notificationsError,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getAllBroadcastMessages(),
    enabled: !!user?.id,
    initialData: notifs,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const notifications = notificationsData || [];

  // ---- Memoized counts ----
  const unreadCount = useMemo(
    () => notifications.filter((item) => item?.isRead === false).length,
    [notifications]
  );
  const readCount = notifications.length - unreadCount;

  // ---- Filtering ----
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    if (readFilter === "unread") {
      filtered = filtered.filter((notif) => notif?.isRead === false);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((notif) => getCategory(notif) === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((notif) => {
        const titleMatch = notif.title?.toLowerCase().includes(query);
        const bodyMatch = notif.body?.toLowerCase().includes(query);
        return titleMatch || bodyMatch;
      });
    }

    return filtered;
  }, [notifications, categoryFilter, searchQuery, readFilter]);

  // ---- Pagination ----
  const paginatedNotifications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));

  // Reset page when filters change (useEffect, not useMemo)
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, searchQuery, readFilter, pageSize]);

  // ---- Mutations ----
  const markAllMutation = useMutation({
    mutationFn: () => changeNotificationStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      customDispatch(globalAlertType("success", "All notifications marked as read"));
    },
    onError: (error) => {
      customDispatch(
        globalAlertType("error", error?.message || "Failed to mark as read")
      );
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => removeNotification(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      customDispatch(globalAlertType("success", "All notifications deleted"));
    },
    onError: (error) => {
      customDispatch(
        globalAlertType("error", error?.message || "Failed to delete notifications")
      );
    },
  });

  // Single-item mutations — NOTE: adjust if your API expects a different
  // signature for single updates (e.g. changeNotificationStatus({ id }))
  const markOneMutation = useMutation({
    mutationFn: (id) => changeNotificationStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      customDispatch(
        globalAlertType("error", error?.message || "Failed to mark as read")
      );
    },
  });

  const deleteOneMutation = useMutation({
    mutationFn: (id) => removeNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      customDispatch(globalAlertType("success", "Notification deleted"));
    },
    onError: (error) => {
      customDispatch(
        globalAlertType("error", error?.message || "Failed to delete notification")
      );
    },
  });

  // ---- Handlers ----
  const handleMarkAsRead = () => {
    if (unreadCount === 0) return;
    Swal.fire({
      title: "Mark as read",
      text: `Mark all ${unreadCount} unread notifications as read?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, mark all",
    }).then(({ isConfirmed }) => {
      if (isConfirmed) markAllMutation.mutate();
    });
  };

  const handleDeleteAll = () => {
    if (!notifications.length) return;
    Swal.fire({
      title: "Delete all notifications",
      text: "You are about to delete all notifications. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete all",
    }).then(({ isConfirmed }) => {
      if (isConfirmed) deleteAllMutation.mutate();
    });
  };

  const handleDeleteOne = (notif) => {
    Swal.fire({
      title: "Delete notification?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
    }).then(({ isConfirmed }) => {
      if (isConfirmed) deleteOneMutation.mutate(notif.id);
    });
  };

  const isItemBusy = (notif) =>
    (markOneMutation.isPending && markOneMutation.variables === notif.id) ||
    (deleteOneMutation.isPending && deleteOneMutation.variables === notif.id);

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setReadFilter("all");
  };

  const handleClearSearch = () => setSearchQuery("");
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handlePageSizeChange = (event) => {
    setPageSize(Number(event.target.value));
    setPage(1);
  };

  if (!user?.id) {
    return <Navigate to="/" replace />;
  }

  // ---- Loading State ----
  if (notificationsLoading) {
    return (
      <AnimatedContainer>
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, bgcolor: "background.default", borderRadius: 1.2 }}>
          <Stack spacing={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="rounded" width={48} height={48} />
                <Stack spacing={1}>
                  <Skeleton variant="text" width={180} height={32} />
                  <Skeleton variant="text" width={240} height={18} />
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Skeleton variant="rounded" width={40} height={40} />
                <Skeleton variant="rounded" width={130} height={40} />
                <Skeleton variant="rounded" width={110} height={40} />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} variant="rounded" height={76} sx={{ flex: 1, minWidth: 130 }} />
              ))}
            </Stack>

            <Skeleton variant="rounded" height={110} />

            {[...Array(4)].map((_, i) => (
              <Stack key={i} direction="row" spacing={2} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1.2 }}>
                <Skeleton variant="rounded" width={42} height={42} />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="text" width="90%" height={18} />
                  <Skeleton variant="text" width="30%" height={14} />
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </AnimatedContainer>
    );
  }

  // ---- Error State ----
  if (notificationsError) {
    return (
      <AnimatedContainer>
        <Paper elevation={0} sx={{ p: 3, bgcolor: "background.default", borderRadius: 1.2 }}>
          <Alert
            severity="error"
            variant="outlined"
            sx={{
              borderRadius: 1.2,
              borderWidth: 2,
              alignItems: "flex-start",
              "& .MuiAlert-icon": { mt: 0.5 },
            }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => refetchNotifications()}
                sx={{ fontWeight: 600, textTransform: "none" }}
              >
                Retry
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={500}>
              Failed to load notifications. Please try again.
            </Typography>
          </Alert>
        </Paper>
      </AnimatedContainer>
    );
  }

  // ---- Main Render ----
  return (
    <AnimatedContainer>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          bgcolor: "background.default",
          borderRadius: 1.2,
          "@keyframes cardIn": {
            from: { opacity: 0, transform: "translateY(10px)" },
            to: { opacity: 1, transform: "none" },
          },
          "@keyframes pulse": {
            "0%": {
              boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.5)}`,
            },
            "100%": {
              boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0)}`,
            },
          },
        }}
      >
        {/* ---- Header ---- */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Badge badgeContent={unreadCount} color="error">
              <Avatar
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: "primary.main",
                  width: 48,
                  height: 48,
                }}
              >
                <NotificationsOutlined />
              </Avatar>
            </Badge>
            <Box>
              <Typography variant="h5" component="h1" fontWeight={800}>
                Notifications
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Stay up to date with everything happening on your account
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Refresh notifications">
              <IconButton onClick={() => refetchNotifications()} sx={{ border: 1, borderColor: "divider" }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mark all as read">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<MarkChatReadIcon />}
                  disabled={unreadCount === 0 || markAllMutation.isPending}
                  onClick={handleMarkAsRead}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                >
                  Mark all read
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Delete all notifications">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteSweepIcon />}
                  disabled={notifications.length === 0 || deleteAllMutation.isPending}
                  onClick={handleDeleteAll}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                >
                  Clear all
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* ---- Stat cards ---- */}
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <StatCard icon={InboxOutlined} label="Total" value={notifications.length} color={theme.palette.info.main} />
          <StatCard icon={NotificationsActiveOutlined} label="Unread" value={unreadCount} color={theme.palette.warning.main} />
          <StatCard icon={CheckCircleOutline} label="Read" value={readCount} color={theme.palette.success.main} />
        </Stack>

        {/* ---- Toolbar: tabs + search + category ---- */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 1.2,
            border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            overflow: "hidden",
          }}
        >
          <Tabs
            value={readFilter}
            onChange={(e, v) => setReadFilter(v)}
            sx={{ borderBottom: 1, borderColor: "divider", px: 1, pt: 0.5, minHeight: 44 }}
          >
            <Tab
              disableRipple
              value="all"
              sx={{ textTransform: "none", fontWeight: 600, minHeight: 44 }}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>All</span>
                  <Chip
                    size="small"
                    label={notifications.length}
                    sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                  />
                </Stack>
              }
            />
            <Tab
              disableRipple
              value="unread"
              sx={{ textTransform: "none", fontWeight: 600, minHeight: 44 }}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Unread</span>
                  <Chip
                    size="small"
                    label={unreadCount}
                    color={unreadCount > 0 ? "error" : "default"}
                    sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                  />
                </Stack>
              }
            />
          </Tabs>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ p: 1.5 }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Search by title or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClearSearch}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {Object.entries(CATEGORY_CONFIG).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: config.color,
                        }}
                      />
                      {config.label}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* ---- Notification List ---- */}
        {notifications.length === 0 ? (
          <EmptyState
            icon={<NotificationsOutlined sx={{ fontSize: 40 }} />}
            title="No notifications yet"
            subtitle="We'll let you know when something new arrives."
          />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={<SearchOffOutlined sx={{ fontSize: 40 }} />}
            title="No matching notifications"
            subtitle="Try adjusting your search or filters."
            action={clearFilters}
          />
        ) : (
          <Stack spacing={1.5}>
            {paginatedNotifications.map((notif, index) => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                index={index}
                isBusy={isItemBusy(notif)}
                onMarkRead={() => markOneMutation.mutate(notif.id)}
                onDelete={() => handleDeleteOne(notif)}
              />
            ))}
          </Stack>
        )}

        {/* ---- Footer: summary + page size + pagination ---- */}
        {filteredNotifications.length > 0 && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
            sx={{
              mt: 3,
              pt: 2,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Showing{" "}
              <strong>
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filteredNotifications.length)}
              </strong>{" "}
              of {filteredNotifications.length}
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" justifyContent="center" useFlexGap>
              <FormControl size="small" sx={{ minWidth: 90 }}>
                <InputLabel id="page-size-label">Rows</InputLabel>
                <Select
                  labelId="page-size-label"
                  value={pageSize}
                  label="Rows"
                  onChange={handlePageSizeChange}
                  sx={{ borderRadius: 2 }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                shape="rounded"
                showFirstButton
                showLastButton
                sx={{
                  "& .MuiPaginationItem-root": {
                    borderRadius: 2,
                    fontWeight: 500,
                  },
                }}
              />
            </Stack>
          </Stack>
        )}
      </Paper>

      {/* Loading overlays for mutations */}
      {(markAllMutation.isPending ||
        deleteAllMutation.isPending ||
        markOneMutation.isPending ||
        deleteOneMutation.isPending) && <GlobalSpinner />}
    </AnimatedContainer>
  );
};

export default Notifications;

// import { useContext, useMemo, useState } from "react";
// import {
//   Box,
//   Stack,
//   Typography,
//   Button,
//   Tooltip,
//   IconButton,
//   Paper,
//   Alert,
//   TextField,
//   MenuItem,
//   InputAdornment,
//   Skeleton,
//   Pagination,
//   FormControl,
//   InputLabel,
//   Select,
//   useTheme,
//   alpha,
// } from "@mui/material";
// import {
//   MarkChatRead as MarkChatReadIcon,
//   DeleteSweep as DeleteSweepIcon,
//   NotificationsOffSharp,
//   Search as SearchIcon,
//   Clear as ClearIcon,
//   Refresh as RefreshIcon,
// } from "@mui/icons-material";
// import moment from "moment";
// import DOMPurify from "dompurify";
// import Swal from "sweetalert2";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { AuthContext } from "../../context/providers/AuthProvider";
// import { useCustomContext } from "../../context/providers/CustomProvider";
// import { globalAlertType } from "../../components/alert/alertType";
// import AnimatedContainer from "../../components/animations/AnimatedContainer";
// import GlobalSpinner from "../../components/GlobalSpinner";
// import {
//   changeNotificationStatus,
//   getAllBroadcastMessages,
//   removeNotification,
// } from "../../api/broadcastMessageAPI";
// import { Navigate } from "react-router-dom";

// // Category options for filtering
// const CATEGORY_OPTIONS = [
//   { value: "all", label: "All Categories" },
//   { value: "ticket", label: "Ticket" },
//   { value: "voucher", label: "Voucher" },
//   { value: "prepaid", label: "Prepaid" },
//   { value: "airtime", label: "Airtime" },
//   { value: "bundle", label: "Bundle" },
//   { value: "wallet", label: "Wallet" },
//   { value: "general", label: "General" },
// ];

// const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

// const Notifications = () => {
//   const theme = useTheme();
//   const { user } = useContext(AuthContext);
//   const { notifications: notifs, customDispatch } = useCustomContext();
//   const queryClient = useQueryClient();

//   // Filter state
//   const [searchQuery, setSearchQuery] = useState("");
//   const [categoryFilter, setCategoryFilter] = useState("all");

//   // Pagination state
//   const [page, setPage] = useState(1);
//   const [pageSize, setPageSize] = useState(10);

//   // Fetch notifications
//   const {
//     data: notificationsData,
//     isLoading: notificationsLoading,
//     error: notificationsError,
//     refetch: refetchNotifications,
//   } = useQuery({
//     queryKey: ["notifications", user?.id],
//     queryFn: () => getAllBroadcastMessages(),
//     enabled: !!user?.id,
//     initialData: notifs,
//     retry: 1,
//     staleTime: 5 * 60 * 1000,
//   });

//   // Memoized counts
//   const unreadCount = useMemo(() => {
//     if (!notificationsData) return 0;
//     return notificationsData.filter(
//       (item) => item?.isRead === false
//     ).length;
//   }, [notificationsData]);

//   // Filter notifications
//   const filteredNotifications = useMemo(() => {
//     if (!notificationsData) return [];

//     let filtered = [...notificationsData];

//     if (categoryFilter !== "all") {
//       filtered = filtered.filter((notif) =>
//         notif.title?.toLowerCase().includes(categoryFilter.toLowerCase())
//       );
//     }

//     if (searchQuery.trim()) {
//       const query = searchQuery.trim().toLowerCase();
//       filtered = filtered.filter((notif) => {
//         const titleMatch = notif.title?.toLowerCase().includes(query);
//         const bodyMatch = notif.body?.toLowerCase().includes(query);
//         return titleMatch || bodyMatch;
//       });
//     }

//     return filtered;
//   }, [notificationsData, categoryFilter, searchQuery]);

//   // Pagination
//   const paginatedNotifications = useMemo(() => {
//     const start = (page - 1) * pageSize;
//     const end = start + pageSize;
//     return filteredNotifications.slice(start, end);
//   }, [filteredNotifications, page, pageSize]);

//   const totalPages = Math.ceil(filteredNotifications.length / pageSize);

//   // Reset page on filter change
//   useMemo(() => {
//     setPage(1);
//   }, [categoryFilter, searchQuery]);

//   // Mutations
//   const markAllMutation = useMutation({
//     mutationFn: () => changeNotificationStatus(),
//     onSuccess: () => {
//       queryClient.invalidateQueries(["notifications"]);
//       customDispatch(
//         globalAlertType("success", "All notifications marked as read")
//       );
//     },
//     onError: (error) => {
//       customDispatch(
//         globalAlertType("error", error?.message || "Failed to mark as read")
//       );
//     },
//   });

//   const deleteAllMutation = useMutation({
//     mutationFn: () => removeNotification(),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["notifications"] });
//       customDispatch(globalAlertType("success", "All notifications deleted"));
//     },
//     onError: (error) => {
//       customDispatch(
//         globalAlertType(
//           "error",
//           error?.message || "Failed to delete notifications"
//         )
//       );
//     },
//   });

//   const handleMarkAsRead = () => {
//     if (unreadCount === 0) return;
//     Swal.fire({
//       title: "Mark as read",
//       text: `Mark all ${unreadCount} unread notifications as read?`,
//       icon: "question",
//       showCancelButton: true,
//       confirmButtonText: "Yes, mark all",
//     }).then((result) => {
//       if (result.isConfirmed) {
//         markAllMutation.mutate();
//       }
//     });
//   };

//   const handleDeleteAll = () => {
//     if (!notificationsData?.length) return;
//     Swal.fire({
//       title: "Delete all notifications",
//       text: "You are about to delete all notifications. This action cannot be undone.",
//       icon: "warning",
//       showCancelButton: true,
//       confirmButtonColor: "#d33",
//       confirmButtonText: "Yes, delete all",
//     }).then((result) => {
//       if (result.isConfirmed) {
//         deleteAllMutation.mutate();
//       }
//     });
//   };

//   const handleClearSearch = () => setSearchQuery("");
//   const handlePageChange = (event, newPage) => {
//     setPage(newPage);
//     window.scrollTo({ top: 0, behavior: "smooth" });
//   };
//   const handlePageSizeChange = (event) => {
//     setPageSize(Number(event.target.value));
//     setPage(1);
//   };

//   if(!user?.id) {
//     return <Navigate to='/' replace/>
//   }

//   // ---- Loading State ----
//   if (notificationsLoading) {
//     return (
//       <AnimatedContainer>
//         <Paper elevation={0} sx={{ p: 3, bgcolor: "background.default" }}>
//           <Stack spacing={3}>
//             <Stack direction="row" justifyContent="space-between" alignItems="center">
//               <Skeleton variant="text" width={180} height={40} />
//               <Stack direction="row" spacing={1}>
//                 <Skeleton variant="circular" width={40} height={40} />
//                 <Skeleton variant="circular" width={40} height={40} />
//                 <Skeleton variant="circular" width={40} height={40} />
//               </Stack>
//             </Stack>
//             <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
//               <Skeleton variant="rounded" height={40} sx={{ flex: 2 }} />
//               <Skeleton variant="rounded" width={160} height={40} />
//             </Stack>
//             {[...Array(Math.min(pageSize, 5))].map((_, i) => (
//               <Paper key={i} elevation={0} sx={{ p: 2 }}>
//                 <Stack spacing={1}>
//                   <Skeleton variant="text" width="70%" height={24} />
//                   <Skeleton variant="text" width="90%" height={20} />
//                   <Skeleton variant="text" width="50%" height={20} />
//                   <Skeleton variant="text" width="30%" height={16} sx={{ alignSelf: "flex-end" }} />
//                 </Stack>
//               </Paper>
//             ))}
//           </Stack>
//         </Paper>
//       </AnimatedContainer>
//     );
//   }

//   // ---- Error State ----
//   if (notificationsError) {
//     return (
//       <AnimatedContainer>
//         <Paper elevation={0} sx={{ p: 3, bgcolor: "background.default" }}>
//           <Alert
//             severity="error"
//             variant="outlined"
//             sx={{
//               borderRadius: 1.2,
//               borderWidth: 2,
//               alignItems: "flex-start",
//               "& .MuiAlert-icon": { mt: 0.5 },
//             }}
//             action={
//               <Button
//                 color="inherit"
//                 size="small"
//                 onClick={() => refetchNotifications()}
//                 sx={{ fontWeight: 600, textTransform: "none" }}
//               >
//                 Retry
//               </Button>
//             }
//           >
//             <Typography variant="body2" fontWeight={500}>
//               Failed to load notifications. Please try again.
//             </Typography>
//           </Alert>
//         </Paper>
//       </AnimatedContainer>
//     );
//   }

//   const notifications = notificationsData || [];

//   // ---- Main Render ----
//   return (
//     <AnimatedContainer>
//       <Paper
//         elevation={0}
//         sx={{
//           p: { xs: 2, sm: 3 },
//           bgcolor: "background.default",
//           borderRadius: 1.2,
//         }}
//       >
//         {/* Header */}
//         <Stack
//           direction="row"
//           justifyContent="flex-end"
//           alignItems="center"
//           sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
//         >
//           {/* <Typography variant="h5" component="h1" fontWeight="bold">
//             Notifications
//           </Typography> */}
//           <Stack direction="row" spacing={1}>
//             <Tooltip title="Refresh notifications">
//               <IconButton color="secondary" onClick={refetchNotifications}>
//                 <RefreshIcon />
//               </IconButton>
//             </Tooltip>
//             <Tooltip title="Mark all as read">
//               <span>
//                 <IconButton
//                   color="secondary"
//                   disabled={unreadCount === 0}
//                   onClick={handleMarkAsRead}
//                 >
//                   <MarkChatReadIcon />
//                 </IconButton>
//               </span>
//             </Tooltip>
//             <Tooltip title="Delete all notifications">
//               <span>
//                 <IconButton
//                   color="error"
//                   disabled={notifications.length === 0}
//                   onClick={handleDeleteAll}
//                 >
//                   <DeleteSweepIcon />
//                 </IconButton>
//               </span>
//             </Tooltip>
//           </Stack>
//         </Stack>

//         {/* Filters */}
//         <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
//           <TextField
//             size="small"
//             placeholder="Search by title or message..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             sx={{ flex: 2 }}
//             InputProps={{
//               startAdornment: (
//                 <InputAdornment position="start">
//                   <SearchIcon fontSize="small" />
//                 </InputAdornment>
//               ),
//               endAdornment: searchQuery && (
//                 <InputAdornment position="end">
//                   <IconButton size="small" onClick={handleClearSearch}>
//                     <ClearIcon fontSize="small" />
//                   </IconButton>
//                 </InputAdornment>
//               ),
//             }}
//           />
//           <TextField
//             select
//             size="small"
//             label="Filter by category"
//             value={categoryFilter}
//             onChange={(e) => setCategoryFilter(e.target.value)}
//             sx={{ minWidth: 160 }}
//           >
//             {CATEGORY_OPTIONS.map((option) => (
//               <MenuItem key={option.value} value={option.value}>
//                 {option.label}
//               </MenuItem>
//             ))}
//           </TextField>
//         </Stack>

//         {/* Summary & Page size */}
//         <Stack
//           direction="row"
//           justifyContent="space-between"
//           alignItems="center"
//           sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
//         >
//           <Typography variant="body2" color="text.secondary">
//             {unreadCount > 0 && (
//               <span>
//                 You have {unreadCount} unread notification
//                 {unreadCount !== 1 ? "s" : ""}. &nbsp;
//               </span>
//             )}
//             {filteredNotifications.length > 0 && (
//               <span>
//                 Showing {paginatedNotifications.length} of{" "}
//                 {filteredNotifications.length}
//               </span>
//             )}
//             {filteredNotifications.length === 0 && "No notifications found"}
//           </Typography>
//           {filteredNotifications.length > 0 && (
//             <FormControl size="small" sx={{ minWidth: 80 }}>
//               <InputLabel id="page-size-label">Per page</InputLabel>
//               <Select
//                 labelId="page-size-label"
//                 value={pageSize}
//                 label="Per page"
//                 onChange={handlePageSizeChange}
//               >
//                 {PAGE_SIZE_OPTIONS.map((size) => (
//                   <MenuItem key={size} value={size}>
//                     {size}
//                   </MenuItem>
//                 ))}
//               </Select>
//             </FormControl>
//           )}
//         </Stack>

//         {/* Notification List */}
//         {filteredNotifications.length === 0 ? (
//           <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
//             <NotificationsOffSharp
//               sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
//             />
//             <Typography variant="h6" color="text.secondary">
//               No notifications yet
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               We&apos;ll let you know when something new arrives.
//             </Typography>
//           </Stack>
//         ) : (
//           <Stack spacing={1}>
//             {paginatedNotifications.map((notif) => {
//               const isUnread = notif?.isRead === false ;
//               return (
//                 <Paper
//                   key={notif.id}
//                   elevation={0}
//                   sx={{
//                     p: 2,
//                     pl: isUnread ? 2.5 : 2,
//                     bgcolor: isUnread
//                       ? alpha(theme.palette.primary.main, 0.04)
//                       : "background.paper",
//                     borderLeft: isUnread
//                       ? `4px solid ${theme.palette.primary.main}`
//                       : "4px solid transparent",
//                     transition: "all 0.2s",
//                     "&:hover": {
//                       bgcolor: isUnread
//                         ? alpha(theme.palette.primary.main, 0.08)
//                         : alpha(theme.palette.action.hover, 0.6),
//                       boxShadow: theme.shadows[1],
//                     },
//                     borderRadius: 2,
//                     border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
//                   }}
//                 >
//                   <Stack spacing={1}>
//                     <Stack direction="row" alignItems="center" spacing={1}>
//                       {isUnread && (
//                         <Box
//                           sx={{
//                             width: 8,
//                             height: 8,
//                             borderRadius: "50%",
//                             bgcolor: "primary.main",
//                             flexShrink: 0,
//                             animation: "pulse 2s infinite",
//                           }}
//                         />
//                       )}
//                       <Typography
//                         variant="subtitle1"
//                         fontWeight={isUnread ? "bold" : "normal"}
//                         sx={{ flex: 1 }}
//                       >
//                         {notif?.title}
//                       </Typography>
//                     </Stack>
//                     {notif?.type === "Email" ? (
//                       <Box
//                         dangerouslySetInnerHTML={{
//                           __html: DOMPurify.sanitize(notif?.body),
//                         }}
//                         sx={{
//                           "& p": { m: 0, fontSize: "0.875rem" },
//                           "& a": { color: "primary.main" },
//                         }}
//                       />
//                     ) : (
//                       <Typography variant="body2" color="text.secondary">
//                         {notif?.body}
//                       </Typography>
//                     )}
//                     {notif?.link && (
//                       <Button
//                         component="a"
//                         href={notif.link}
//                         target="_blank"
//                         rel="noopener noreferrer"
//                         size="small"
//                         variant="text"
//                         sx={{
//                           alignSelf: "flex-start",
//                           p: 0,
//                           textTransform: "none",
//                           fontWeight: 600,
//                         }}
//                       >
//                         Download
//                       </Button>
//                     )}
//                     <Typography
//                       variant="caption"
//                       color="text.disabled"
//                       sx={{ textAlign: "right" }}
//                     >
//                       {moment(notif?.createdAt).fromNow()}
//                     </Typography>
//                   </Stack>
//                 </Paper>
//               );
//             })}
//           </Stack>
//         )}

//         {/* Pagination */}
//         {filteredNotifications.length > pageSize && (
//           <Stack
//             direction="row"
//             justifyContent="center"
//             alignItems="center"
//             spacing={2}
//             sx={{ mt: 3 }}
//           >
//             <Pagination
//               count={totalPages}
//               page={page}
//               onChange={handlePageChange}
//               color="primary"
//               shape="rounded"
//               showFirstButton
//               showLastButton
//               size="large"
//               sx={{
//                 "& .MuiPaginationItem-root": {
//                   borderRadius: 2,
//                   fontWeight: 500,
//                 },
//               }}
//             />
//           </Stack>
//         )}
//       </Paper>

//       {/* Loading overlays for mutations */}
//       {(markAllMutation.isPending || deleteAllMutation.isPending) && (
//         <GlobalSpinner />
//       )}
//     </AnimatedContainer>
//   );
// };

// export default Notifications;
