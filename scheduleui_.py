import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import calendar
import random
from datetime import datetime
import holidays

# 1. 근무 관리 엔진
class DutyEngine:
    def __init__(self):
        self.kr_holidays = holidays.KR()
        self.assignments = {}  # 날짜별 근무자 저장
        self.candidate_list = ["김철수", "이영희", "박지민", "최우주", "정다운"] 
        self.duty_count = 1 # 한 번에 근무할 인원수

    def is_duty_day(self, year, month, day):
        try:
            d = datetime(year, month, day)
            return d.weekday() >= 5 or d in self.kr_holidays
        except: 
            return False

    def get_random_candidates(self):
        # 인원수만큼 랜덤 추출
        count = min(self.duty_count, len(self.candidate_list))
        return random.sample(self.candidate_list, count)

# 2. 근무자 관리 탭
class MemberTab(tk.Frame):
    def __init__(self, parent, engine, refresh_callback):
        super().__init__(parent)
        self.engine = engine
        self.refresh_callback = refresh_callback 
        
        tk.Label(self, text="근무자 명단 및 설정", font=("Arial", 12, "bold")).pack(pady=10)
        
        # 근무 인원수 설정
        setting_frame = tk.Frame(self)
        setting_frame.pack(pady=5)
        tk.Label(setting_frame, text="근무 인원수:").pack(side="left")
        self.count_spin = tk.Spinbox(setting_frame, from_=1, to=5, width=5)
        self.count_spin.delete(0, "end")
        self.count_spin.insert(0, str(self.engine.duty_count))
        self.count_spin.pack(side="left", padx=5)
        
        self.listbox = tk.Listbox(self, width=30, height=15)
        self.listbox.pack(pady=5)
        self.refresh_list()
        
        btn_frame = tk.Frame(self)
        btn_frame.pack(pady=10)
        tk.Button(btn_frame, text="사다리 타기(순번 정하기)", command=self.shuffle_members, bg="yellow").pack(side="left", padx=5)
        tk.Button(btn_frame, text="자동 배정 적용(1일~말일)", command=self.auto_assign, bg="lightblue").pack(side="left", padx=5)
        
    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for member in self.engine.candidate_list:
            self.listbox.insert(tk.END, member)
            
    def shuffle_members(self):
        random.shuffle(self.engine.candidate_list)
        self.refresh_list()
        messagebox.showinfo("순번 정하기", "순번이 랜덤으로 재배정되었습니다!")

    def auto_assign(self):
        try:
            self.engine.duty_count = int(self.count_spin.get())
        except:
            self.engine.duty_count = 1
            
        if not messagebox.askyesno("확인", f"현재 명단에서 {self.engine.duty_count}명씩 휴일 근무를 자동 배정하시겠습니까?"):
            return
        
        self.engine.assignments = {}
        candidate_idx = 0
        num_candidates = len(self.engine.candidate_list)
        
        now = datetime.now()
        cal = calendar.Calendar(firstweekday=6).monthdatescalendar(now.year, now.month)
        for week in cal:
            for date_obj in week:
                if date_obj.month == now.month and self.engine.is_duty_day(now.year, now.month, date_obj.day):
                    # 인원수만큼 할당
                    names = []
                    for _ in range(self.engine.duty_count):
                        names.append(self.engine.candidate_list[candidate_idx % num_candidates])
                        candidate_idx += 1
                    self.engine.assignments[f"{now.year}-{now.month}-{date_obj.day}"] = ", ".join(names)
        
        self.refresh_callback()
        messagebox.showinfo("완료", "자동 배정이 완료되었습니다.")

# 3. 달력 탭 모듈
class CalendarTab(tk.Frame):
    def __init__(self, parent, engine):
        super().__init__(parent)
        self.engine = engine
        now = datetime.now()
        self.year, self.month = now.year, now.month
        
        self.header_frame = tk.Frame(self)
        self.header_frame.pack(pady=10)
        self.cal_frame = tk.Frame(self)
        self.cal_frame.pack()
        
        self.refresh_calendar()

    def refresh_calendar(self):
        for widget in self.header_frame.winfo_children():
            widget.destroy()
        for widget in self.cal_frame.winfo_children():
            widget.destroy()

        tk.Button(self.header_frame, text="< 이전달", command=self.prev_month).pack(side="left", padx=10)
        tk.Label(self.header_frame, text=f"{self.year}년 {self.month}월", font=("Arial", 14, "bold")).pack(side="left", padx=10)
        tk.Button(self.header_frame, text="다음달 >", command=self.next_month).pack(side="left", padx=10)

        days = ["일", "월", "화", "수", "목", "금", "토"]
        for i, day in enumerate(days):
            tk.Label(self.cal_frame, text=day, font=("Arial", 10, "bold"), fg="red" if i==0 else "black").grid(row=0, column=i)
        
        cal = calendar.Calendar(firstweekday=6).monthdatescalendar(self.year, self.month)
        for r, week in enumerate(cal):
            for c, date_obj in enumerate(week):
                if date_obj.month == self.month:
                    is_duty = self.engine.is_duty_day(self.year, self.month, date_obj.day)
                    date_key = f"{self.year}-{self.month}-{date_obj.day}"
                    name = self.engine.assignments.get(date_key, "")
                    
                    btn_text = f"{date_obj.day}\n{name}" if name else str(date_obj.day)
                    btn = tk.Button(self.cal_frame, text=btn_text, width=12, height=4,
                                    state="normal" if is_duty else "disabled",
                                    bg="#e74c3c" if is_duty else "#ecf0f1",
                                    command=lambda d=date_obj.day: self._on_click(d))
                    btn.grid(row=r+1, column=c, padx=2, pady=2)

    def prev_month(self):
        self.month -= 1
        if self.month < 1: self.month = 12; self.year -= 1
        self.refresh_calendar()

    def next_month(self):
        self.month += 1
        if self.month > 12: self.month = 1; self.year += 1
        self.refresh_calendar()

    def _on_click(self, day):
        choice = messagebox.askyesnocancel("근무자 배정", "[예]: 직접 입력\n[아니오]: 랜덤 배정")
        if choice is True:
            name = simpledialog.askstring("입력", "이름 (쉼표로 구분):")
            if name:
                self.engine.assignments[f"{self.year}-{self.month}-{day}"] = name
        elif choice is False:
            names = self.engine.get_random_candidates()
            self.engine.assignments[f"{self.year}-{self.month}-{day}"] = ", ".join(names)
        
        self.refresh_calendar()

# 4. 메인 앱
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("문서 관리 및 근무 통합 시스템")
        self.geometry("1100x900")
        self.engine = DutyEngine()
        
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both")
        
        self.tab2 = CalendarTab(self.notebook, self.engine)
        self.tab1 = MemberTab(self.notebook, self.engine, self.tab2.refresh_calendar)
        self.notebook.add(self.tab1, text="근무자 관리")
        self.notebook.add(self.tab2, text="휴일 근무 관리")

if __name__ == "__main__":
    app = App()
    app.mainloop()