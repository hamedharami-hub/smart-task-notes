package app.lovable.d7e345911914455da5aa800df1140813;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String BASE_URL = "https://d7e34591-1914-455d-a5aa-800df1140813.lovableproject.com/app/today";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(BASE_URL));
        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(browserIntent);
        finish();
    }
}
