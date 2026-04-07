import React from "react";
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 24, color = "#000" }: IconProps) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const f = { fill: color, stroke: "none" };

  const icons: Record<string, React.ReactNode> = {
    "alert-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Line x1="12" y1="8" x2="12" y2="12" {...s}/><Line x1="12" y1="16" x2="12.01" y2="16" {...s}/></>),
    "alert-triangle": (<><Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" {...s}/><Line x1="12" y1="9" x2="12" y2="13" {...s}/><Line x1="12" y1="17" x2="12.01" y2="17" {...s}/></>),
    "arrow-down-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Polyline points="8,12 12,16 16,12" {...s}/><Line x1="12" y1="8" x2="12" y2="16" {...s}/></>),
    "arrow-left": (<><Line x1="19" y1="12" x2="5" y2="12" {...s}/><Polyline points="12,19 5,12 12,5" {...s}/></>),
    "arrow-up-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Polyline points="16,12 12,8 8,12" {...s}/><Line x1="12" y1="16" x2="12" y2="8" {...s}/></>),
    "bar-chart-2": (<><Line x1="18" y1="20" x2="18" y2="10" {...s}/><Line x1="12" y1="20" x2="12" y2="4" {...s}/><Line x1="6" y1="20" x2="6" y2="14" {...s}/></>),
    "bell": (<><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...s}/><Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/></>),
    "bell-off": (<><Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/><Path d="M18.63 13A17.89 17.89 0 0 1 18 8" {...s}/><Path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" {...s}/><Path d="M18 8a6 6 0 0 0-9.33-5" {...s}/><Line x1="1" y1="1" x2="23" y2="23" {...s}/></>),
    "camera": (<><Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...s}/><Circle cx="12" cy="13" r="4" {...s}/></>),
    "camera-off": (<><Line x1="1" y1="1" x2="23" y2="23" {...s}/><Path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" {...s}/><Circle cx="12" cy="13" r="4" {...s}/></>),
    "check": (<Polyline points="20,6 9,17 4,12" {...s}/>),
    "check-circle": (<><Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" {...s}/><Polyline points="22,4 12,14.01 9,11.01" {...s}/></>),
    "chevron-left": (<Polyline points="15,18 9,12 15,6" {...s}/>),
    "chevron-right": (<Polyline points="9,18 15,12 9,6" {...s}/>),
    "cpu": (<><Rect x="4" y="4" width="16" height="16" rx="2" ry="2" {...s}/><Rect x="9" y="9" width="6" height="6" {...s}/><Line x1="9" y1="1" x2="9" y2="4" {...s}/><Line x1="15" y1="1" x2="15" y2="4" {...s}/><Line x1="9" y1="20" x2="9" y2="23" {...s}/><Line x1="15" y1="20" x2="15" y2="23" {...s}/><Line x1="20" y1="9" x2="23" y2="9" {...s}/><Line x1="20" y1="14" x2="23" y2="14" {...s}/><Line x1="1" y1="9" x2="4" y2="9" {...s}/><Line x1="1" y1="14" x2="4" y2="14" {...s}/></>),
    "credit-card": (<><Rect x="1" y="4" width="22" height="16" rx="2" ry="2" {...s}/><Line x1="1" y1="10" x2="23" y2="10" {...s}/></>),
    "download-cloud": (<><Polyline points="8,17 12,21 16,17" {...s}/><Line x1="12" y1="12" x2="12" y2="21" {...s}/><Path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" {...s}/></>),
    "external-link": (<><Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" {...s}/><Polyline points="15,3 21,3 21,9" {...s}/><Line x1="10" y1="14" x2="21" y2="3" {...s}/></>),
    "file": (<><Path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...s}/><Polyline points="13,2 13,9 20,9" {...s}/></>),
    "file-text": (<><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s}/><Polyline points="14,2 14,8 20,8" {...s}/><Line x1="16" y1="13" x2="8" y2="13" {...s}/><Line x1="16" y1="17" x2="8" y2="17" {...s}/><Polyline points="10,9 9,9 8,9" {...s}/></>),
    "help-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...s}/><Line x1="12" y1="17" x2="12.01" y2="17" {...s}/></>),
    "home": (<><Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...s}/><Polyline points="9,22 9,12 15,12 15,22" {...s}/></>),
    "image": (<><Rect x="3" y="3" width="18" height="18" rx="2" ry="2" {...s}/><Circle cx="8.5" cy="8.5" r="1.5" {...s}/><Polyline points="21,15 16,10 5,21" {...s}/></>),
    "inbox": (<><Polyline points="22,12 16,12 14,15 10,15 8,12 2,12" {...s}/><Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" {...s}/></>),
    "info": (<><Circle cx="12" cy="12" r="10" {...s}/><Line x1="12" y1="8" x2="12" y2="8" {...s}/><Line x1="12" y1="12" x2="12" y2="16" {...s}/></>),
    "key": (<Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" {...s}/>),
    "list": (<><Line x1="8" y1="6" x2="21" y2="6" {...s}/><Line x1="8" y1="12" x2="21" y2="12" {...s}/><Line x1="8" y1="18" x2="21" y2="18" {...s}/><Line x1="3" y1="6" x2="3.01" y2="6" {...s}/><Line x1="3" y1="12" x2="3.01" y2="12" {...s}/><Line x1="3" y1="18" x2="3.01" y2="18" {...s}/></>),
    "lock": (<><Rect x="3" y="11" width="18" height="11" rx="2" ry="2" {...s}/><Path d="M7 11V7a5 5 0 0 1 10 0v4" {...s}/></>),
    "log-out": (<><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...s}/><Polyline points="16,17 21,12 16,7" {...s}/><Line x1="21" y1="12" x2="9" y2="12" {...s}/></>),
    "mail": (<><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" {...s}/><Polyline points="22,6 12,13 2,6" {...s}/></>),
    "message-square": (<Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/>),
    "monitor": (<><Rect x="2" y="3" width="20" height="14" rx="2" ry="2" {...s}/><Line x1="8" y1="21" x2="16" y2="21" {...s}/><Line x1="12" y1="17" x2="12" y2="21" {...s}/></>),
    "pause-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Line x1="10" y1="15" x2="10" y2="9" {...s}/><Line x1="14" y1="15" x2="14" y2="9" {...s}/></>),
    "pie-chart": (<><Path d="M21.21 15.89A10 10 0 1 1 8 2.83" {...s}/><Path d="M22 12A10 10 0 0 0 12 2v10z" {...s}/></>),
    "plus": (<><Line x1="12" y1="5" x2="12" y2="19" {...s}/><Line x1="5" y1="12" x2="19" y2="12" {...s}/></>),
    "plus-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Line x1="12" y1="8" x2="12" y2="16" {...s}/><Line x1="8" y1="12" x2="16" y2="12" {...s}/></>),
    "radio": (<><Circle cx="12" cy="12" r="2" {...s}/><Path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" {...s}/></>),
    "refresh-cw": (<><Polyline points="23,4 23,10 17,10" {...s}/><Polyline points="1,20 1,14 7,14" {...s}/><Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" {...s}/></>),
    "search": (<><Circle cx="11" cy="11" r="8" {...s}/><Line x1="21" y1="21" x2="16.65" y2="16.65" {...s}/></>),
    "send": (<><Line x1="22" y1="2" x2="11" y2="13" {...s}/><Polygon points="22,2 15,22 11,13 2,9" {...s}/></>),
    "settings": (<><Circle cx="12" cy="12" r="3" {...s}/><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" {...s}/></>),
    "shield": (<Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...s}/>),
    "slash": (<><Circle cx="12" cy="12" r="10" {...s}/><Line x1="4.93" y1="4.93" x2="19.07" y2="19.07" {...s}/></>),
    "sliders": (<><Line x1="4" y1="21" x2="4" y2="14" {...s}/><Line x1="4" y1="10" x2="4" y2="3" {...s}/><Line x1="12" y1="21" x2="12" y2="12" {...s}/><Line x1="12" y1="8" x2="12" y2="3" {...s}/><Line x1="20" y1="21" x2="20" y2="16" {...s}/><Line x1="20" y1="12" x2="20" y2="3" {...s}/><Line x1="1" y1="14" x2="7" y2="14" {...s}/><Line x1="9" y1="8" x2="15" y2="8" {...s}/><Line x1="17" y1="16" x2="23" y2="16" {...s}/></>),
    "tag": (<><Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" {...s}/><Line x1="7" y1="7" x2="7.01" y2="7" {...s}/></>),
    "target": (<><Circle cx="12" cy="12" r="10" {...s}/><Circle cx="12" cy="12" r="6" {...s}/><Circle cx="12" cy="12" r="2" {...s}/></>),
    "trash-2": (<><Polyline points="3,6 5,6 21,6" {...s}/><Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" {...s}/><Line x1="10" y1="11" x2="10" y2="17" {...s}/><Line x1="14" y1="11" x2="14" y2="17" {...s}/></>),
    "trending-down": (<><Polyline points="23,18 13.5,8.5 8.5,13.5 1,6" {...s}/><Polyline points="17,18 23,18 23,12" {...s}/></>),
    "trending-up": (<><Polyline points="23,6 13.5,15.5 8.5,10.5 1,18" {...s}/><Polyline points="17,6 23,6 23,12" {...s}/></>),
    "unlock": (<><Rect x="3" y="11" width="18" height="11" rx="2" ry="2" {...s}/><Path d="M7 11V7a5 5 0 0 1 9.9-1" {...s}/></>),
    "user": (<><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...s}/><Circle cx="12" cy="7" r="4" {...s}/></>),
    "x": (<><Line x1="18" y1="6" x2="6" y2="18" {...s}/><Line x1="6" y1="6" x2="18" y2="18" {...s}/></>),
    "x-circle": (<><Circle cx="12" cy="12" r="10" {...s}/><Line x1="15" y1="9" x2="9" y2="15" {...s}/><Line x1="9" y1="9" x2="15" y2="15" {...s}/></>),
    "zap": (<Polygon points="13,2 3,14 12,14 11,22 21,10 12,10" {...s}/>),
    "clipboard": (<><Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" {...s}/><Rect x="8" y="2" width="8" height="4" rx="1" ry="1" {...s}/></>),
    "alert-octagon": (<><Polygon points="7.86,2 16.14,2 22,7.86 22,16.14 16.14,22 7.86,22 2,16.14 2,7.86" {...s}/><Line x1="12" y1="8" x2="12" y2="12" {...s}/><Line x1="12" y1="16" x2="12.01" y2="16" {...s}/></>),
  };

  const content = icons[name];

  if (!content) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth={2} strokeLinecap="round"/>
        <Line x1="20" y1="4" x2="4" y2="20" stroke={color} strokeWidth={2} strokeLinecap="round"/>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {content}
    </Svg>
  );
}
