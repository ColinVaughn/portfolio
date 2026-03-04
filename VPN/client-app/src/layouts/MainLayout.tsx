import { useNavigate } from "@solidjs/router";
import TabBar from "../components/TabBar";
import Sidebar from "../components/Sidebar";
import Titlebar from "../components/Titlebar";
import UpdateBanner from "../components/UpdateBanner";

export default function MainLayout(props: { children: any }) {
  const navigate = useNavigate();

  return (
    <div class="flex flex-col h-screen">
      {/* OS Titlebar Replacement */}
      <Titlebar />

      {/* Update Banner */}
      <UpdateBanner />

      <div class="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Page content */}
        <main class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative z-0">
          {props.children}
        </main>
      </div>

      {/* Bottom tab bar */}
      <div class="shrink-0">
        <TabBar />
      </div>
    </div>
  );
}
