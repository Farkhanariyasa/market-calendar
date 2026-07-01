"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import useSWR from "swr";

const FullCalendarComponent = FullCalendar as any;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CalendarDashboard({ session }: { session: any }) {
  const { data: events, mutate } = useSWR("/api/events", fetcher, {
    refreshInterval: 3000,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [imageLink, setImageLink] = useState<string>("");
  const [market, setMarket] = useState<string>("US");

  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.date);
    setImageLink("");
    setMarket("US");
    setIsModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    const evt = events?.find((e: any) => e.id === arg.event.id);
    if (evt) {
      setSelectedEvent(evt);
    }
  };

  const createEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title");
    const description = formData.get("description");

    if (!selectedDate || !title) return;

    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        image: imageLink,
        market: market,
        startTime: selectedDate.toISOString(),
        endTime: new Date(selectedDate.getTime() + 60 * 60 * 1000).toISOString(),
      }),
    });

    setIsModalOpen(false);
    mutate();
  };

  const getMarketColor = (m: string) => {
    if (m === "US") return "#3b82f6"; // Blue
    if (m === "INDO") return "#ef4444"; // Red
    if (m === "BOTH") return "#a855f7"; // Purple
    if (m === "PROJECTS") return "#10b981"; // Green
    if (m === "OTHER") return "#f59e0b"; // Orange
    return "#3b82f6";
  };

  const formattedEvents = events?.map((evt: any) => ({
    id: evt.id,
    title: evt.title,
    start: evt.startTime,
    end: evt.endTime,
    backgroundColor: getMarketColor(evt.market),
    borderColor: getMarketColor(evt.market),
  })) || [];

  return (
    <div className="flex h-screen bg-[#0f172a] text-white">
      {/* Sidebar - Made smaller so calendar is bigger */}
      <div className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
            C
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">CalBot</h2>
            <p className="text-xs text-slate-400">Market System</p>
          </div>
        </div>

        <button 
          onClick={() => { setSelectedDate(new Date()); setImageLink(""); setMarket("US"); setIsModalOpen(true); }}
          className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-3 rounded-xl font-medium shadow-lg shadow-blue-500/20"
        >
          + Create Event
        </button>

        <div className="mt-4 flex-1">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Upcoming Closed
          </h3>
          <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-2">
            {events?.filter((e: any) => new Date(e.startTime) >= new Date()).slice(0, 5).map((evt: any) => (
              <div 
                key={evt.id} 
                className="bg-slate-800 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer flex gap-2 items-start"
                onClick={() => setSelectedEvent(evt)}
              >
                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0`} style={{ backgroundColor: getMarketColor(evt.market) }}></div>
                <div>
                  <div className="font-medium text-sm truncate">{evt.title}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(evt.startTime).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-700 flex items-center gap-3">
          {session.user?.image && (
            <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full" />
          )}
          <div className="text-sm">
            <div className="font-medium">{session.user?.name}</div>
            <div className="text-xs text-slate-400">Admin</div>
          </div>
        </div>
      </div>

      {/* Main Calendar Area - Maximize space */}
      <div className="flex-1 p-4 overflow-hidden h-full flex flex-col">
        <div className="flex-1 bg-slate-800/30 rounded-xl border border-slate-700/50 backdrop-blur-xl p-4 shadow-2xl overflow-hidden">
          <FullCalendarComponent
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek",
            }}
            events={formattedEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="100%"
            dayMaxEvents={true}
            editable={true}
            eventDrop={async (info: any) => {
              await fetch(`/api/events/${info.event.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  startTime: info.event.start?.toISOString(),
                  endTime: info.event.end?.toISOString(),
                }),
              });
              mutate();
            }}
          />
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Create New Event</h3>
            <form onSubmit={createEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input 
                  name="title" 
                  required 
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500" 
                  placeholder="Market Closed..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Market</label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="market" value="US" checked={market === "US"} onChange={() => setMarket("US")} className="text-blue-500" />
                    US (Blue)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="market" value="INDO" checked={market === "INDO"} onChange={() => setMarket("INDO")} className="text-red-500" />
                    INDO (Red)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="market" value="BOTH" checked={market === "BOTH"} onChange={() => setMarket("BOTH")} className="text-purple-500" />
                    Both (Purple)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="market" value="PROJECTS" checked={market === "PROJECTS"} onChange={() => setMarket("PROJECTS")} className="text-green-500" />
                    Projects (Green)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="market" value="OTHER" checked={market === "OTHER"} onChange={() => setMarket("OTHER")} className="text-orange-500" />
                    Other (Orange)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description (HTML allowed)</label>
                <textarea 
                  name="description" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm" 
                  placeholder="Reason for closure..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cover Image Link</label>
                <input 
                  type="url" 
                  value={imageLink}
                  onChange={(e) => setImageLink(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500" 
                  placeholder="https://example.com/image.png"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-700 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {selectedEvent.image && (
              <img src={selectedEvent.image} alt={selectedEvent.title} className="w-full h-48 object-cover flex-shrink-0" />
            )}
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 text-xs font-bold rounded-full text-white" style={{ backgroundColor: getMarketColor(selectedEvent.market) }}>
                  {selectedEvent.market} MARKET
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2">{selectedEvent.title}</h3>
              <div className="text-sm text-blue-400 font-medium mb-4">
                {new Date(selectedEvent.startTime).toLocaleDateString()}
              </div>
              {selectedEvent.description && (
                <div 
                  className="text-slate-300 mb-6 prose prose-invert max-w-none" 
                  dangerouslySetInnerHTML={{ __html: selectedEvent.description }} 
                />
              )}
              
              <div className="flex gap-3 justify-end border-t border-slate-700 pt-4 mt-2">
                <button 
                  onClick={async () => {
                    if (confirm("Are you sure you want to delete this event?")) {
                      await fetch(`/api/events/${selectedEvent.id}`, { method: "DELETE" });
                      mutate();
                      setSelectedEvent(null);
                    }
                  }}
                  className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors mr-auto"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
