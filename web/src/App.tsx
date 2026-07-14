import { Routes, Route, useLocation } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { AuthCallback } from "./pages/AuthCallback";
import { Send } from "./pages/Send";
import { Claim } from "./pages/Claim";
import { Home } from "./pages/Home";
import { Receipts } from "./pages/Receipts";
import { NavBar } from "./components/NavBar";
import { RequireAuth } from "./components/RequireAuth";

const NAV_ROUTES = ["/home", "/send", "/receipts"];

function App() {
  const location = useLocation();
  const showNav = NAV_ROUTES.includes(location.pathname);

  return (
    // Backdrop fills the viewport; the inner column is the app. On mobile it is
    // full-bleed edge to edge; on desktop it centers as a ~430px phone-shaped
    // frame with a rounded border and shadow so it reads as an intentional device,
    // not a mobile layout stretched across a wide screen.
    <div className="app-backdrop min-h-dvh md:flex md:items-center md:justify-center md:p-6">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950 md:h-[880px] md:min-h-0 md:max-h-[90dvh] md:rounded-[2.5rem] md:border md:border-zinc-200 md:shadow-2xl md:shadow-black/20 dark:md:border-zinc-800">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/send"
              element={
                <RequireAuth>
                  <Send />
                </RequireAuth>
              }
            />
            <Route path="/c/:linkId" element={<Claim />} />
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/receipts"
              element={
                <RequireAuth>
                  <Receipts />
                </RequireAuth>
              }
            />
          </Routes>
        </div>
        {showNav && <NavBar />}
      </div>
    </div>
  );
}

export default App;
