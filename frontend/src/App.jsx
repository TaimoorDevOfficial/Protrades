import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Holdings from "./pages/Holdings.jsx";
import SettingsPage from "./pages/Settings.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import MarketBrief from "./pages/Market.jsx";
import Intel from "./pages/Intel.jsx";
import Trade from "./pages/Trade.jsx";
import Chartink from "./pages/Chartink.jsx";
import Contact from "./pages/Contact.jsx";
import { SessionDataProvider } from "./context/SessionDataContext.jsx";

function PrivateLayout() {
  return (
    <SessionDataProvider>
      <Layout>
        <Outlet />
      </Layout>
    </SessionDataProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateLayout />}>
        <Route path="/intel" element={<Intel />} />
        <Route path="/market" element={<MarketBrief />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/chartink" element={<Chartink />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to="/intel" replace />}
      />
    </Routes>
  );
}
