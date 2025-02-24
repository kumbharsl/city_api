import tkinter as tk
from tkinter import ttk
import webbrowser

class GoogleSearchUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Google Search")
        self.root.geometry("800x500")
        self.root.configure(bg="white")
        
        # Create main frame
        self.main_frame = tk.Frame(root, bg="white")
        self.main_frame.pack(expand=True)
        
        # Google logo
        self.logo_label = tk.Label(
            self.main_frame,
            text="Google",
            font=("Arial", 40, "bold"),
            bg="white"
        )
        self.logo_label.pack(pady=20)
        
        # Color the letters
        self.logo_label.config(
            fg="blue"
        )
        
        # Search frame
        self.search_frame = tk.Frame(self.main_frame, bg="white")
        self.search_frame.pack(pady=20)
        
        # Search entry
        self.search_entry = ttk.Entry(
            self.search_frame,
            width=50,
            font=("Arial", 12)
        )
        self.search_entry.pack(pady=10)
        
        # Style for the buttons
        style = ttk.Style()
        style.configure(
            "Custom.TButton",
            padding=6,
            relief="flat",
            background="#f8f9fa"
        )
        
        # Buttons frame
        self.button_frame = tk.Frame(self.main_frame, bg="white")
        self.button_frame.pack(pady=10)
        
        # Google Search button
        self.search_button = ttk.Button(
            self.button_frame,
            text="Google Search",
            style="Custom.TButton",
            command=self.perform_search
        )
        self.search_button.pack(side=tk.LEFT, padx=5)
        
        # I'm Feeling Lucky button
        self.lucky_button = ttk.Button(
            self.button_frame,
            text="I'm Feeling Lucky",
            style="Custom.TButton",
            command=self.feeling_lucky
        )
        self.lucky_button.pack(side=tk.LEFT, padx=5)
        
        # Bind Enter key to search
        self.search_entry.bind("<Return>", lambda event: self.perform_search())
        
        # Focus on search entry
        self.search_entry.focus()
    
    def perform_search(self):
        query = self.search_entry.get()
        if query:
            # Create Google search URL and open in browser
            search_url = f"https://www.google.com/search?q={query}"
            webbrowser.open(search_url)
    
    def feeling_lucky(self):
        query = self.search_entry.get()
        if query:
            # Create I'm Feeling Lucky URL and open in browser
            lucky_url = f"https://www.google.com/search?q={query}&btnI"
            webbrowser.open(lucky_url)

if __name__ == "__main__":
    root = tk.Tk()
    app = GoogleSearchUI(root)
    root.mainloop()