import {
  Avatar,
  Box,
  Button,
  Container,
  // Unstable_Grid2 as Grid,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import {
  BarChartRounded,
  PaymentRounded,
  RefreshRounded,
  PhoneInTalk,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import ItemCard from "@/components/custom/ItemCard";
import CustomCard from "@/components/custom/CustomCard";
import PieChart from "@/components/charts/PieChart";
import PlainTable from "@/components/tables/PlainTable";
import BarChart from "@/components/charts/BarChart";
import { getTotalSales } from "@/api/transactionAPI";
import LineChart from "@/components/charts/LineChart";
import { useTheme } from "@emotion/react";
import { recentTransactionColumns } from "@/mocks/columns";
import PayLoading from "@/components/PayLoading";
import CustomTitle from "@/components/custom/CustomTitle";
import { currencyFormatter, IMAGES } from "@/constants";
import CountUp from "react-countup";
import Community from "@/components/home/Community";
import { AuthContext } from "@/context/providers/AuthProvider";
import { useContext } from "react";

function Overall() {
  const { user } = useContext(AuthContext);
  const { palette } = useTheme();
  const summary = useQuery({
    queryKey: ["total-sales"],
    queryFn: () => getTotalSales(),
    initialData: {
      totalSales: {
        airtime: 0,
        bundle: 0,
        total: 0,
      },
      totalCount: {
        labels: [],
        data: [],
      },
      recents: [],
      today: {
        airtime: 0,
        bundle: 0,
      },
      sevenDays: {
        labels: [],
        voucher: {
          data: [],
        },
        ecg: {
          data: [],
        },
      },
      transactionByMonth: {
        labels: [],
        voucher: {
          data: [],
        },
        ecg: {
          data: [],
        },
      },
    },
    enabled: !!user?.id,
  });

  if (summary?.isLoading) {
    return <PayLoading />;
  }

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          pt: 2,
        }}
      >
        <Box>
          <Typography variant="h4" textAlign={{ xs: "left", md: "right" }}>
            Welcome,{user?.firstname || ""}
          </Typography>
          <Typography>Your current dashboard for today!</Typography>
        </Box>
        <Avatar
          alt="wave_hand"
          src={IMAGES.hand}
          style={{ width: "48px", height: "48px" }}
          variant="square"
        />
      </Box>
      <Community />
      <CustomTitle
        title="Dashboard"
        titleVariant="h2"
        subtitle="Powerful Transactions: Elevate Your Experience with Tickets, Vouchers, and Prepaid Units"
        // icon={<BarChart sx={{ width: 50, height: 50 }} color='primary' />}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            // justifyContent: "flex-end",
            width: "100",
            gap: 1,
            flexGrow: 1,
          }}
        >
          <Button
            variant="contained"
            // startIcon={<RefreshRounded />}
            onClick={summary.refetch}
            sx={{
              borderRadius: 1,
              my: 4,
            }}
          >
            <Link style={{ color: "#fff" }} to="airtime/transactions">
              Sell Airtime
            </Link>
          </Button>
          <Button
            variant="contained"
            // startIcon={<RefreshRounded />}
            onClick={summary.refetch}
            sx={{
              borderRadius: 1,
              my: 4,
            }}
          >
            <Link style={{ color: "#fff" }} to="bundle/transactions">
              Sell Data
            </Link>
          </Button>
        </Box>

        <Button
          variant="contained"
          startIcon={<RefreshRounded />}
          onClick={summary.refetch}
          sx={{
            display: { xs: "none", sm: "flex" },
            borderRadius: 1,
            my: 4,
          }}
        >
          Refresh
        </Button>
      </div>
      <Stack spacing={4}>
        <CustomCard title="Total Sales">
          <ItemCard
            title="Total"
            icon={<BarChartRounded htmlColor="rgb(0, 20, 34)" />}
            value={currencyFormatter(summary?.data?.totalSales?.total)}
            component={
              // 0
              <CountUp
                start={0}
                end={summary?.data?.totalSales?.total}
                prefix="GHS "
                decimals={3}
              />
            }
            bg={"rgba(0, 20, 34,.2)"}
          />

          <ItemCard
            title="Data Bundle"
            icon={<PaymentRounded color="secondary" />}
            value={currencyFormatter(summary?.data?.totalSales?.bundle)}
            component={
              // 0
              <CountUp
                start={0}
                end={summary?.data?.totalSales?.bundle}
                prefix="GHS "
                decimals={3}
              />
            }
            bg={"rgba(255, 126, 5,.2)"}
          />

          <ItemCard
            title="Airtime"
            value={currencyFormatter(summary?.data?.totalSales?.airtime)}
            icon={<PhoneInTalk htmlColor="rgba(12, 126, 5)" />}
            component={
              <CountUp
                start={0}
                end={summary?.data?.totalSales?.airtime}
                prefix="GHS "
                decimals={3}
                enableScrollSpy={true}
              />
            }
            bg={"rgba(12, 126, 5,.2)"}
          />
        </CustomCard>

        <Grid container spacing={1} my={2}>
          <Grid item  xs={12} md={7}>
            <CustomCard title="Recent Transactions">
              <PlainTable
                isLoading={summary.isLoading}
                columns={recentTransactionColumns}
                data={summary?.data?.recents}
                options={{
                  paging: false,
                }}
              />
            </CustomCard>
          </Grid>

          <Grid item xs={12} md={5}>
            <CustomCard title="Total Sales Count">
              <PieChart
                labels={summary?.data?.totalCount?.labels}
                data={summary?.data?.totalCount?.data}
              />
            </CustomCard>
          </Grid>
        </Grid>

        <Grid container spacing={1}>
          <Grid item  xs={12} md={4}>
            <CustomCard title="Today Sales ">
              <Stack
                py={2}
                justifyContent="center"
                alignItems="center"
                spacing={4}
              >
                <ItemCard
                  title="Data Bundle"
                  value={currencyFormatter(summary?.data?.today?.bundle || 0)}
                  icon={<PaymentRounded color="warning" />}
                  component={
                    <CountUp
                      start={0}
                      end={summary?.data?.today?.bundle || 0}
                      prefix="GHS "
                      decimals={3}
                    />
                  }
                  bg="rgba(255, 126, 5,0.2)"
                />

                <ItemCard
                  title="Airtime Transfers"
                  icon={<PhoneInTalk htmlColor="rgb(12, 126, 5)" />}
value={summary?.data?.today?.airtime || 0}
                  
                  component={
                    <CountUp
                      start={0}
                      end={summary?.data?.today?.airtime || 0}
                      prefix="GHS "
                      decimals={3}
                    />
                  }
                  bg="rgba(12, 126, 5,.2)"
                />
              </Stack>
            </CustomCard>
          </Grid>

          <Grid item xs={12} md={8}>
            <CustomCard title="Total Sales for Last 7 Days (GHS)">
              <LineChart
                height={300}
                labels={summary?.data?.sevenDays?.labels}
                datasets={[
                  {
                    label: "Data Bundle",
                    data: summary?.data?.sevenDays?.bundle?.data ?? [],
                    borderColor: palette.warning.main,
                    tension: 0.3,
                  },

                  {
                    label: "Airtime Units",
                    data: summary?.data?.sevenDays?.airtime?.data ?? [],
                    borderColor: palette.success.main,
                    tension: 0.3,
                  },
                ]}
              />
            </CustomCard>
          </Grid>
        </Grid>

        <CustomCard title="Cummulative Transactions by Months (GHS)">
          <BarChart
            labels={summary?.data?.transactionByMonth?.labels}
            datasets={[
              {
                label: "Data Bundle",
                data: summary?.data?.transactionByMonth?.bundle?.data ?? [],
                backgroundColor: palette.warning.main,
                barThickness: 20,
                borderRadius: 2,
              },

              {
                label: "Airtime Transfers",
                data: summary?.data?.transactionByMonth?.airtime?.data ?? [],
                backgroundColor: palette.success.main,
                barThickness: 20,
                borderRadius: 2,
              },
            ]}
          />
        </CustomCard>
      </Stack>
    </Container>
  );
}

export default Overall;
