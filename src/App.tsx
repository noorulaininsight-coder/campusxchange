import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { Guard } from "./components/Guard";
import { Home } from "./pages/Home";
import { Empty, Loading } from "./components/Common";
const Marketplace = lazy(() =>
  import("./pages/Marketplace").then((m) => ({ default: m.Marketplace })),
);
const SignIn = lazy(() =>
  import("./pages/SignIn").then((m) => ({ default: m.SignIn })),
);
const Password = lazy(() =>
  import("./pages/Password").then((m) => ({ default: m.Password })),
);
const ProfileForm = lazy(() =>
  import("./pages/ProfileForm").then((m) => ({ default: m.ProfileForm })),
);
const ListingDetail = lazy(() =>
  import("./pages/ListingDetail").then((m) => ({ default: m.ListingDetail })),
);
const ListingEditor = lazy(() =>
  import("./pages/ListingEditor").then((m) => ({ default: m.ListingEditor })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const PublicProfile = lazy(() =>
  import("./pages/PublicProfile").then((m) => ({ default: m.PublicProfile })),
);
const Admin = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Admin })),
);
const Legal = lazy(() =>
  import("./pages/Legal").then((m) => ({ default: m.Legal })),
);
const Messages = lazy(() =>
  import("./pages/Messages").then((m) => ({ default: m.Messages })),
);
const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20000, refetchOnWindowFocus: true },
  },
});
export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense
            fallback={
              <div className="container-page py-10">
                <Loading />
              </div>
            }
          >
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="signin" element={<SignIn key="signin" />} />
                <Route
                  path="signup"
                  element={<SignIn key="signup" mode="signup" />}
                />
                <Route
                  path="forgot-password"
                  element={<SignIn key="recovery" mode="recovery" />}
                />
                <Route path="listing/:id" element={<ListingDetail />} />
                <Route path="profile/:id" element={<PublicProfile />} />
                {["privacy", "terms", "safety"].map((p) => (
                  <Route key={p} path={p} element={<Legal />} />
                ))}
                <Route element={<Guard onboarding />}>
                  <Route path="onboarding" element={<ProfileForm />} />
                  <Route path="password" element={<Password />} />
                </Route>
                <Route element={<Guard />}>
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:id" element={<Messages />} />
                  <Route path="post" element={<ListingEditor />} />
                  <Route path="listing/:id/edit" element={<ListingEditor />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="saved" element={<Dashboard />} />
                  <Route path="settings" element={<ProfileForm />} />
                </Route>
                <Route element={<Guard admin />}>
                  <Route path="admin" element={<Admin />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <div className="container-page py-12">
                      <Empty title="This page took a different route">
                        <Link
                          to="/marketplace"
                          className="text-brand underline"
                        >
                          Back to marketplace
                        </Link>
                      </Empty>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
