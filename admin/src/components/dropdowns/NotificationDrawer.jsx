import { useState, useMemo, useContext } from "react";
import {
  Drawer,
  IconButton,
  Stack,
  Typography,
  Tooltip,
  TextField,
  InputAdornment,
  Badge,
  Box,
  alpha,
  CircularProgress,
  Button,
} from "@mui/material";
import {
  Close,
  Notifications,
  Search as SearchIcon,
  MarkChatRead as MarkChatReadIcon,
  DeleteSweep as DeleteSweepIcon,
  NotificationsOff as NotificationsOffIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import DOMPurify from "dompurify";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  markAllNotificationsAsRead,
  deleteNotifications,
} from "../../api/notificationAPI"; // adjust import
import { useCustomContext } from "../../context/providers/CustomProvider";
import { globalAlertType } from "../../components/alert/alertType";
import { useAuth } from "@/context/providers/AuthProvider";

const NotificationDrawer = ({ open, setOpen, notifications = [] }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { customDispatch } = useCustomContext(); // you'll need to import useContext

  const [searchTerm, setSearchTerm] = useState("");

  // Filter notifications based on search term
  const filteredNotifications = useMemo(() => {
    if (!searchTerm.trim()) return notifications;
    const term = searchTerm.toLowerCase();
    return notifications.filter(
      (n) =>
        n.title?.toLowerCase().includes(term) ||
        n.message?.toLowerCase().includes(term),
    );
  }, [notifications, searchTerm]);

  const unreadCount = notifications.filter((n) => n.active === 1).length;

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      customDispatch(
        globalAlertType("success", "Notifications marked as read"),
      );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      customDispatch(
        globalAlertType("error", err.message || "Failed to mark as read"),
      );
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => deleteNotifications(user?.id),
    onSuccess: () => {
      customDispatch(globalAlertType("success", "All notifications cleared"));
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      customDispatch(globalAlertType("error", "Failed to clear notifications"));
    },
  });

  const handleClose = () => setOpen(false);
  const goToNotifications = () => {
    navigate("/notifications");
    handleClose();
  };
  const handleMarkAllRead = () => markReadMutation.mutate();
  const handleClearAll = () => deleteAllMutation.mutate();

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      anchor="right"
      PaperProps={{ sx: { width: { xs: 320, md: 450 } } }}
    >
      <Stack sx={{ height: "100vh" }}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 2, bgcolor: "primary.main", color: "white" }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Badge badgeContent={unreadCount} color="error">
              <Notifications sx={{ color: "white" }} />
            </Badge>
            <Typography variant="h6" fontWeight={600}>
              Notifications
            </Typography>
          </Stack>
          <IconButton onClick={handleClose} sx={{ color: "white" }}>
            <Close />
          </IconButton>
        </Stack>

        {/* Actions & Search */}
        <Stack
          spacing={1.5}
          sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Stack direction="row" spacing={1}>
            <Tooltip title="Mark all as read">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MarkChatReadIcon />}
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0 || markReadMutation.isPending}
                >
                  Mark read
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Clear all notifications">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteSweepIcon />}
                  onClick={handleClearAll}
                  disabled={
                    notifications.length === 0 || deleteAllMutation.isPending
                  }
                >
                  Clear all
                </Button>
              </span>
            </Tooltip>
          </Stack>
          <TextField
            size="small"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            fullWidth
          />
        </Stack>

        {/* Notifications List */}
        <Stack sx={{ flex: 1, overflowY: "auto", p: 1 }}>
          {filteredNotifications.length === 0 ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ height: "100%", py: 8 }}
            >
              <NotificationsOffIcon
                sx={{ fontSize: 48, color: "text.secondary", mb: 1 }}
              />
              <Typography color="text.secondary">
                {searchTerm
                  ? "No matching notifications"
                  : "No notifications yet"}
              </Typography>
            </Stack>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={goToNotifications}
              />
            ))
          )}
        </Stack>

        {/* Footer */}
        <Typography
          variant="caption"
          align="center"
          sx={{ py: 1, color: "text.disabled" }}
        >
          Gab Powerful Consult &copy; {new Date().getFullYear()}
        </Typography>

        {/* Loading overlays */}
        {(markReadMutation.isPending || deleteAllMutation.isPending) && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1200,
            }}
          >
            <CircularProgress />
          </Box>
        )}
      </Stack>
    </Drawer>
  );
};

// --- Individual Notification Item Component ---
const NotificationItem = ({ notification, onClick }) => {
  const isUnread = notification.active === 1;

  return (
    <Stack
      onClick={onClick}
      sx={{
        cursor: "pointer",
        transition: "background 0.2s",
        "&:hover": { bgcolor: alpha("#000", 0.04) },
        p: 1.5,
        borderRadius: 1.2,
        mb: 1,
        bgcolor: isUnread ? alpha("#fabb7f", 0.2) : "transparent",
        borderLeft: isUnread ? "3px solid #fabb7f" : "none",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 0.5 }}
      >
        <Typography variant="subtitle2" fontWeight={600} color="primary.main">
          {notification.title}
        </Typography>
        {isUnread && <CheckCircleIcon fontSize="small" color="warning" />}
      </Stack>

      {notification.type === "Email" ? (
        <Box
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(notification.body),
          }}
          sx={{
            fontSize: "0.85rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            color: "text.secondary",
            mb: 1,
          }}
        />
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            mb: 1,
          }}
        >
          {notification.body}
        </Typography>
      )}

      <Typography
        variant="caption"
        color="text.disabled"
        align="right"
        sx={{ display: "block" }}
      >
        {moment(notification.createdAt).fromNow()}
      </Typography>
    </Stack>
  );
};

export default NotificationDrawer;

// import {
//   Drawer,
//   IconButton,
//   Stack,
//   Typography,
//   Tooltip,
//   Divider,
// } from "@mui/material";

// import _ from "lodash";
// import { AnimatePresence } from "framer-motion";
// import { Close, Notifications } from "@mui/icons-material";
// import moment from "moment";
// import DOMPurify from "dompurify";
// import {  useNavigate } from "react-router-dom";
// import { Fragment } from "react";

// const NotificationDrawer = ({ open, setOpen, notifications }) => {
//   const navigate = useNavigate();

//   const handleClose = () => setOpen(false);

//   const goToTransactions = () => {
//     navigate("/notifications");
//     handleClose();
//   };

//   return (
//     <Drawer
//       open={open}
//       onClose={handleClose}
//       sx={{ zIndex: 9999 }}
//       anchor="right"
//     >
//       <Stack
//         sx={{
//           minHeight: "100vh",
//           width: { xs: 280, md: 500 },
//           display: "grid",
//           gridTemplateRows: "auto 1fr auto",
//           pb: 1,
//         }}
//         bgcolor="#fff"
//         spacing={1}
//       >
//         <Stack
//           bgcolor="primary.main"
//           direction="row"
//           justifyContent="space-between"
//           alignItems="center"
//           p={1}
//         >
//           <Notifications htmlColor="#fff" />
//           <Typography color="white" sx={{ pl: 1, flexGrow: 1 }}>
//             Notifications
//           </Typography>

//           {/* <Tooltip title="Refresh Notifications">
//             <IconButton onClick={notifications?.refetch()}>
//               <Refresh />
//             </IconButton>
//           </Tooltip> */}
//           <Tooltip title="Close">
//             <IconButton onClick={handleClose}>
//               <Close />
//             </IconButton>
//           </Tooltip>
//         </Stack>
//         {/* <Stack
//           direction="row"
//           justifyContent="flex-end"
//           alignItems="center"
//           pr={2}
//           spacing={2}
//         >
//           <Tooltip title="">
//             <Button size="small" onClick={handleMarkAllAsRead}>
//               Mark all as read
//             </Button>
//           </Tooltip>

//           <Tooltip title="">
//             <Button size="small" onClick={handleRemoveAll}>
//               Clear All
//             </Button>
//           </Tooltip>
//         </Stack> */}

//         {/* {notifications.isLoading ? (
//           <Typography>Please Wait...</Typography>
//         ) : notifications?.isError ? (
//           <Typography>An error has occurred..</Typography>
//         ) : ( */}
//           <>
//             {notifications?.length === 0 ? (
//               <Stack
//                 spacing={2}
//                 height="80svh"
//                 justifyContent="center"
//                 alignItems="center"
//                 overflow="auto"
//               >
//                 <Typography>No new Notifications</Typography>
//               </Stack>
//             ) : (
//               <AnimatePresence>
//                 <Stack spacing={1} height="90svh" overflow="auto">
//                   {notifications?.map((notification) => {
//                     return (
//                       <Fragment key={notification?._id}>
//                         <Stack
//                           onClick={goToTransactions}
//                           sx={{
//                             cursor: "pointer",
//                             "&:hover": {
//                               backgroundColor: "whitesmoke",
//                             },
//                             p: 1,
//                             bgcolor: notification?.active ? "#fabb7f30" : null,
//                           }}
//                         >
//                           <Stack
//                             direction="row"
//                             justifyContent="space-between"
//                             alignItems="center"
//                             pr={2}
//                           >
//                             <Typography
//                               color="primary.main"
//                               px={1}
//                               variant="body2"
//                               textTransform="capitalize"
//                               fontWeight='700'
//                             >
//                               {notification?.title}
//                             </Typography>
//                             <Notifications sx={{ width: 16, height: 16 }} />
//                           </Stack>
//                           {notification?.type === "Email" ? (
//                             <div
//                               dangerouslySetInnerHTML={{
//                                 __html: DOMPurify.sanitize(
//                                   notification?.message
//                                 ),
//                               }}
//                               style={{ padding: "16px",     overflow: "hidden", // Ensures the text doesn't overflow the container
//                                 textOverflow: "ellipsis", // Adds the ellipsis to the truncated text
//                                 display: "-webkit-box", // Use a flexbox model with block-level boxes
//                                 WebkitBoxOrient: "vertical", // Ensures that the flexbox layout is vertical          // Hides any text that overflows the container
//                                 WebkitLineClamp: 3, }}
//                             ></div>
//                           ) : (
//                             <Typography
//                               variant="body2"
//                               color="primary.main"
//                               // p={1}

//                               sx={{
//                                 overflow: "hidden", // Ensures the text doesn't overflow the container
//                                 textOverflow: "ellipsis", // Adds the ellipsis to the truncated text
//                                 display: "-webkit-box", // Use a flexbox model with block-level boxes
//                                 WebkitBoxOrient: "vertical", // Ensures that the flexbox layout is vertical          // Hides any text that overflows the container
//                                 WebkitLineClamp: 3,
//                               }}
//                             >
//                               {notification?.message}
//                             </Typography>
//                           )}
//                           <Typography p={1} fontSize={10} textAlign="right">
//                             {moment(notification?.createdAt).fromNow()}
//                           </Typography>
//                         </Stack>
//                         <Divider flexItem />
//                       </Fragment>
//                     );
//                   })}
//                 </Stack>
//               </AnimatePresence>
//             )}
//           </>
//         {/* )} */}

//         <Typography variant="caption" textAlign="center">
//           Gab Powerful Consult &copy; {new Date().getFullYear()}
//         </Typography>
//       </Stack>
//     </Drawer>
//   );
// };

// export default NotificationDrawer;
