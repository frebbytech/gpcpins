import {
  Alert,
  Avatar,
  Box,
  Button,
  Grid,
  IconButton,
  InputBase,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountBalanceWalletRounded,
  BarChartRounded,
  BoltRounded,
  DataArray,
  HistoryRounded,
  PaymentRounded,
  PhoneInTalk,
  DonutLargeRounded,
  ReceiptLongRounded,
  RefreshRounded,
  SearchRounded,
  ShowChartRounded,
  TodayRounded,
  WarningAmberRounded,
  CardTravelSharp,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import ItemCard from "@/components/custom/ItemCard";
import CustomCard from "@/components/custom/CustomCard";
import BalanceTile from "@/components/custom/BalanceTile";
import PieChart from "@/components/charts/PieChart";
import PlainTable from "@/components/tables/PlainTable";
import BarChart from "@/components/charts/BarChart";
import { getTotalSales } from "@/api/transactionAPI";
import LineChart from "@/components/charts/LineChart";
import { recentTransactionColumns } from "@/mocks/columns";
import { currencyFormatter, IMAGES } from "@/constants";
import CountUp from "react-countup";
import CustomStepper from "@/components/custom/CustomStepper";
import AnimatedContainer from "@/components/animations/AnimatedContainer";
import { useNavigate } from "react-router-dom";
import {  useMemo, useState } from "react";
import { useAuth } from "@/context/providers/AuthProvider";
import { allBalance } from "@/api/paymentAPI";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

// Category colors kept consistent with the accents already in use across the
// app (vouchers = amber, prepaid/ECG = info blue, airtime = green, data = red)
// so charts, stat tiles, and the summary card all agree with each other.
const CATEGORY_COLORS = {
  total: "#001422",
  voucher: "#FF7E05",
  ecg: "#0288D1",
  airtime: "#0C7E05",
  bundle: "#b10508",
};

function Overall() {
  const { user } = useAuth();
  const [showAlert, setShowAlert] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();

  const summary = useQuery({
    queryKey: ["total-sales"],
    queryFn: () => getTotalSales(),
    initialData: {
      totalSales: { ecg: 0, voucher: 0, airtime: 0, bundle: 0, total: 0 },
      totalCount: {
        labels: [
          "Vouchers & Tickets",
          "Prepaid Units",
          "Airtime Transfer",
          "Data Bundle",
        ],
        data: [0, 0, 0, 0],
      },
      recents: [],
      today: { voucher: 0, ecg: 0, airtime: 0, bundle: 0 },
      sevenDays: {
        labels: [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        voucher: { data: [] },
        ecg: { data: [] },
        bundle: { data: [] },
        airtime: { data: [] },
      },
      transactionByMonth: {
        labels: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
        voucher: { data: [] },
        ecg: { data: [] },
        bundle: { data: [] },
        airtime: { data: [] },
      },
      logs: [],
    },
  });

  const { data: balances, isLoading } = useQuery({
    queryKey: ["all-balance"],
    queryFn: () => allBalance(),
    initialData: { pos: 0.0, pre: 0.0, balance: 0.0, brassicaBalance: 0 },
    enabled: !!user?.id,
    retry: 1,
  });

  const lowBalanceNotices = useMemo(() => {
    const notices = [];
    if (Number(balances?.balance) < 1000) {
      notices.push(
        `Your ONE4ALL top-up balance is low — ${currencyFormatter(balances?.balance)} remaining.`,
      );
    }
    if (Number(balances?.pre) < 1000) {
      notices.push(
        `Your Hubtel Prepaid balance is low — ${currencyFormatter(
          balances?.pre,
        )} remaining, so refunds can't be processed until it's topped up.`,
      );
    }
    // if (Number(balances?.brassicaBalance) < 1000) {
    //   notices.push(
    //     `Your Brassica balance is low — ${currencyFormatter(
    //       balances?.brassicaBalance,
    //     )} remaining, so recharges can't be processed until it's topped up.`,
    //   );
    // }
    return notices;
  }, [balances]);

  const handleOnSearchClicked = () => {
    if (!searchValue) return;
    // Same query params the rest of the app's transaction search relies on — left unchanged.
    navigate(
      `/summary/transactions?YixHy=a34cdd3543&_pid=423423&1=&_search=${searchValue}`,
    );
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") handleOnSearchClicked();
  };

  if (summary?.isLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {/* Header toolbar: greeting + search + refresh in one place */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ pt: 3 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            alt="wave"
            src={IMAGES.hand}
            variant="rounded"
            sx={{ width: 44, height: 44 }}
          />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Welcome, {user?.firstname}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Here&apos;s what&apos;s happening across your dashboard today.
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ width: { xs: "100%", md: "auto" } }}
        >
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              flex: 1,
              minWidth: { md: 320 },
              border: "1px solid",
              borderColor: (theme) => theme.palette.divider,
              borderRadius: 1.2,
              pl: 1.5,
              pr: 0.5,
              py: 0.25,
              bgcolor: "background.paper",
              "&:focus-within": { borderColor: "primary.main" },
            }}
          >
            <SearchRounded
              fontSize="small"
              sx={{ color: "text.disabled", mr: 1 }}
            />
            <InputBase
              placeholder="Search transactions..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target?.value)}
              onKeyDown={handleSearchKeyDown}
              sx={{ flex: 1, fontSize: 14 }}
            />
            <Button
              variant="contained"
              size="small"
              disableElevation
              onClick={handleOnSearchClicked}
              disabled={searchValue === ""}
              sx={{ borderRadius: 1.2, minWidth: 0, px: 1.5 }}
            >
              <SearchRounded fontSize="small" />
            </Button>
          </Stack>

          <Tooltip title="Refresh dashboard">
            <span>
              <IconButton
                onClick={summary.refetch}
                disabled={summary.isFetching}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1.2,
                }}
              >
                <RefreshRounded
                  fontSize="small"
                  sx={{
                    animation: summary.isFetching
                      ? "spin 0.8s linear infinite"
                      : "none",
                    "@keyframes spin": { to: { transform: "rotate(360deg)" } },
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Low balance notices — one combined banner instead of stacked duplicates */}
      {showAlert && lowBalanceNotices.length > 0 && (
        <Alert
          variant="outlined"
          severity="warning"
          icon={<WarningAmberRounded fontSize="small" />}
          onClose={() => setShowAlert(false)}
          sx={{
            borderRadius: 1.2,
            bgcolor: (theme) => `${theme.palette.warning.main}0F`,
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <Stack spacing={0.5}>
            {lowBalanceNotices.map((notice) => (
              <Typography key={notice} variant="body2">
                {notice}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      {/* Account balances */}
      <AnimatedContainer delay={0.1}>
        <CustomCard
          title="Account Balance"
          subtitle="Live wallet balances across providers"
          icon={<AccountBalanceWalletRounded fontSize="small" />}
          width="220px"
        >
          <BalanceTile
            label="ONE4ALL Top Up Balance"
            sublabel="Wallet balance in your ONE4ALL account"
            value={currencyFormatter(balances?.balance)}
            icon={<AccountBalanceWalletRounded />}
            color={CATEGORY_COLORS.total}
            isLow={Number(balances?.balance) < 1000}
          />
          <BalanceTile
            label="HUBTEL POS Balance"
            sublabel="POS sales balance"
            value={currencyFormatter(balances?.pos)}
            icon={<PaymentRounded />}
            color={CATEGORY_COLORS.voucher}
          />
          <BalanceTile
            label="HUBTEL PREPAID Balance"
            sublabel="Prepaid deposit balance"
            value={currencyFormatter(balances?.pre)}
            icon={<BoltRounded />}
            color={CATEGORY_COLORS.ecg}
            isLow={Number(balances?.pre) < 1000}
          />
          <BalanceTile
            label="BRASSICA Balance"
            sublabel="Available float balance"
            value={currencyFormatter(balances?.brassicaBalance)}
            icon={<CardTravelSharp />}
            color={CATEGORY_COLORS.ecg}
            isLow={Number(balances?.brassicaBalance) < 1000}
          />
        </CustomCard>
      </AnimatedContainer>

      {/* Total sales */}
      <AnimatedContainer delay={0.2}>
        <CustomCard
          title="Total Sales"
          subtitle="All-time totals by category"
          icon={<BarChartRounded fontSize="small" />}
        >
          <ItemCard
            title="Total"
            icon={<BarChartRounded />}
            color={CATEGORY_COLORS.total}
            value={currencyFormatter(summary?.data?.totalSales?.total)}
          />
          <ItemCard
            title="Vouchers & Tickets"
            icon={<PaymentRounded />}
            color={CATEGORY_COLORS.voucher}
            value={currencyFormatter(summary?.data?.totalSales?.voucher || 0)}
          />
          <ItemCard
            title="Prepaid Units"
            icon={<BoltRounded />}
            color={CATEGORY_COLORS.ecg}
            value={currencyFormatter(summary?.data?.totalSales?.ecg)}
          />
          <ItemCard
            title="Airtime"
            icon={<PhoneInTalk />}
            color={CATEGORY_COLORS.airtime}
            value={currencyFormatter(summary?.data?.totalSales?.airtime)}
          />
          <ItemCard
            title="Data Bundle"
            icon={<DataArray />}
            color={CATEGORY_COLORS.bundle}
            value={currencyFormatter(summary?.data?.totalSales?.bundle || 0)}
          />
        </CustomCard>
      </AnimatedContainer>

      {/* Recent transactions + totals breakdown */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <AnimatedContainer delay={0.3}>
            <CustomCard
              title="Recent Transactions"
              icon={<ReceiptLongRounded fontSize="small" />}
            >
              <PlainTable
                isLoading={summary.isLoading}
                columns={recentTransactionColumns}
                data={summary?.data?.recents}
                options={{ paging: false }}
              />
            </CustomCard>
          </AnimatedContainer>
        </Grid>

        <Grid item xs={12} md={5}>
          <AnimatedContainer delay={0.4}>
            <CustomCard
              title="Total Sales Count"
              icon={<DonutLargeRounded fontSize="small" />}
            >
              <PieChart
                labels={summary?.data?.totalCount?.labels}
                data={summary?.data?.totalCount?.data}
              />
            </CustomCard>
          </AnimatedContainer>
        </Grid>
      </Grid>

      {/* Today + trend */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <AnimatedContainer delay={0.5}>
            <CustomCard
              title="Today's Sales"
              icon={<TodayRounded fontSize="small" />}
              width="100%"
            >
              <Stack spacing={2}>
                <ItemCard
                  title="Vouchers & Tickets"
                  icon={<PaymentRounded />}
                  color={CATEGORY_COLORS.voucher}
                  value={
                    <CountUp
                      start={0}
                      end={summary?.data?.today?.voucher || 0}
                      prefix="GHS "
                      decimals={2}
                    />
                  }
                />
                <ItemCard
                  title="Prepaid Units"
                  icon={<BoltRounded />}
                  color={CATEGORY_COLORS.ecg}
                  value={
                    <CountUp
                      start={0}
                      end={summary?.data?.today?.ecg || 0}
                      prefix="GHS "
                      decimals={2}
                    />
                  }
                />
                <ItemCard
                  title="Airtime Transfers"
                  icon={<PhoneInTalk />}
                  color={CATEGORY_COLORS.airtime}
                  value={
                    <CountUp
                      start={0}
                      end={summary?.data?.today?.airtime || 0}
                      prefix="GHS "
                      decimals={2}
                    />
                  }
                />
                <ItemCard
                  title="Data Bundle"
                  icon={<DataArray />}
                  color={CATEGORY_COLORS.bundle}
                  value={
                    <CountUp
                      start={0}
                      end={summary?.data?.today?.bundle || 0}
                      prefix="GHS "
                      decimals={2}
                    />
                  }
                />
              </Stack>
            </CustomCard>
          </AnimatedContainer>
        </Grid>

        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <AnimatedContainer delay={0.6}>
              <CustomCard
                title="Total Sales for Last 7 Days (GHS)"
                icon={<ShowChartRounded fontSize="small" />}
              >
                <LineChart
                  height={300}
                  labels={summary?.data?.sevenDays?.labels}
                  datasets={[
                    {
                      label: "Vouchers & Tickets",
                      data: summary?.data?.sevenDays?.voucher?.data || [],
                      borderColor: CATEGORY_COLORS.voucher,
                      tension: 0.3,
                    },
                    {
                      label: "Prepaid Units",
                      data: summary?.data?.sevenDays?.ecg?.data || [],
                      borderColor: CATEGORY_COLORS.ecg,
                      tension: 0.3,
                    },
                    {
                      label: "Airtime Units",
                      data: summary?.data?.sevenDays?.airtime?.data || [],
                      borderColor: CATEGORY_COLORS.airtime,
                      tension: 0.3,
                    },
                    {
                      label: "Data Bundle",
                      data: summary?.data?.sevenDays?.bundle?.data || [],
                      borderColor: CATEGORY_COLORS.bundle,
                      tension: 0.3,
                    },
                  ]}
                />
              </CustomCard>
            </AnimatedContainer>

            <AnimatedContainer delay={0.65}>
              <CustomCard
                title="Activity Log"
                icon={<HistoryRounded fontSize="small" />}
                width="100%"
              >
                <CustomStepper logs={summary?.data?.logs} />
              </CustomCard>
            </AnimatedContainer>
          </Stack>
        </Grid>
      </Grid>

      {/* Monthly totals */}
      <AnimatedContainer delay={0.7}>
        <CustomCard
          title="Cumulative Transactions by Month (GHS)"
          icon={<BarChartRounded fontSize="small" />}
          width="100%"
        >
          <BarChart
            labels={summary?.data?.transactionByMonth?.labels}
            datasets={[
              {
                label: "Vouchers & Tickets",
                data: summary?.data?.transactionByMonth?.voucher?.data || [],
                backgroundColor: CATEGORY_COLORS.voucher,
                barThickness: 20,
                borderRadius: 1.2,
              },
              {
                label: "Prepaid Units",
                data: summary?.data?.transactionByMonth?.ecg?.data || [],
                backgroundColor: CATEGORY_COLORS.ecg,
                barThickness: 20,
                borderRadius: 1.2,
              },
              {
                label: "Airtime Transfers",
                data: summary?.data?.transactionByMonth?.airtime?.data || [],
                backgroundColor: CATEGORY_COLORS.airtime,
                barThickness: 20,
                borderRadius: 1.2,
              },
              {
                label: "Data Bundle",
                data: summary?.data?.transactionByMonth?.bundle?.data || [],
                backgroundColor: CATEGORY_COLORS.bundle,
                barThickness: 20,
                borderRadius: 1.2,
              },
            ]}
          />
        </CustomCard>
      </AnimatedContainer>
    </Stack>
  );
}

export default Overall;
