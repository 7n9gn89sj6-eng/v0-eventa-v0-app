// ... existing code ...

  describe("parseTime", () => {
    it("should parse 12-hour format with pm", () => {
      expect(parseTime("8pm")).toBe("20:00")
      expect(parseTime("8:30pm")).toBe("20:30")
      expect(parseTime("8:30 pm")).toBe("20:30")
    })

    it("should parse 12-hour format with am", () => {
      expect(parseTime("8am")).toBe("08:00")
      expect(parseTime("8:30am")).toBe("08:30")
    })

    it("should parse 24-hour format", () => {
      expect(parseTime("20:00")).toBe("20:00")
      expect(parseTime("08:30")).toBe("08:30")
    })

    it("should handle noon and midnight", () => {
      expect(parseTime("12pm")).toBe("12:00")
      expect(parseTime("12am")).toBe("00:00")
    })

    it("should return null for invalid times", () => {
      expect(parseTime("25:00")).toBeNull()
      expect(parseTime("8:70pm")).toBeNull()
      expect(parseTime("invalid")).toBeNull()
    })

    // <CHANGE> Add defensive validation tests
    it("should reject hours outside 1-12 for 12-hour format", () => {
      expect(parseTime("0am")).toBeNull()
      expect(parseTime("13pm")).toBeNull()
      expect(parseTime("15am")).toBeNull()
      expect(parseTime("0:30pm")).toBeNull()
    })

    it("should reject hours outside 0-23 for 24-hour format", () => {
      expect(parseTime("24:00")).toBeNull()
      expect(parseTime("25:30")).toBeNull()
      expect(parseTime("30:00")).toBeNull()
    })

    it("should reject minutes outside 0-59", () => {
      expect(parseTime("8:60pm")).toBeNull()
      expect(parseTime("8:99am")).toBeNull()
      expect(parseTime("20:60")).toBeNull()
      expect(parseTime("10:75")).toBeNull()
    })

    it("should reject negative inputs", () => {
      expect(parseTime("-5pm")).toBeNull()
      expect(parseTime("8:-30pm")).toBeNull()
      expect(parseTime("-8:30")).toBeNull()
    })

    it("should reject non-numeric inputs", () => {
      expect(parseTime("abc:30pm")).toBeNull()
      expect(parseTime("8:xypm")).toBeNull()
      expect(parseTime("nottime")).toBeNull()
    })

    it("should accept valid edge cases", () => {
      expect(parseTime("1am")).toBe("01:00")
      expect(parseTime("12pm")).toBe("12:00")
      expect(parseTime("12am")).toBe("00:00")
      expect(parseTime("0:00")).toBe("00:00")
      expect(parseTime("23:59")).toBe("23:59")
    })
    // </CHANGE>
  })

// ... existing code ...
