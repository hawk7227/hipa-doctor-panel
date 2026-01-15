'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Video, Play, GripVertical, Clock, X } from 'lucide-react'
import ZoomMtgEmbedded from '@zoomus/websdk/embedded';
 

const App = () => {
  const meetingNumber = "YOUR_MEETING_NUMBER";
  const passWord = "YOUR_MEETING_PASSWORD"; // Optional, if set
  const userName = "John Doe";
  const [signature, setSignature] = useState(null);

  useEffect(() => {
    const getSignature = async () => {
      // Replace with your actual auth endpoint URL
      const authEndpoint = "http://localhost:4000/api/get-signature";

      try {
        const req = await fetch(authEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingNumber: meetingNumber,
            role: 0,
          }),
        });
        const res = await req.json();
        setSignature(res.signature as string);
      } catch (e) {
        console.error(e);
      }
    };

    getSignature();
  }, [meetingNumber]);

  if (!signature) return <div>Loading Zoom meeting...</div>;

  return (
    <ZoomMeeting
      meetingNumber={meetingNumber}
      userName={userName}
      signature={signature}
      password={passWord}
    />
  );
};

export default App;






