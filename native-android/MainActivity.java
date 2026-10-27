package com.af4.ai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalLLMPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
