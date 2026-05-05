package filters

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// remove quotes and replace * by regex any
var valueReplacer = strings.NewReplacer(`*`, `.*`, `"`, "")

type labelMatcher string

const (
	labelEqual           = labelMatcher("=")
	labelMatches         = labelMatcher("=~")
	labelNotEqual        = labelMatcher("!=")
	labelMoreThanOrEqual = labelMatcher(">=")
	labelNoMatches       = labelMatcher("!~")
)

type valueType int

const (
	typeNumber valueType = iota
	typeBool
	typeString
	typeRegex
	typeRegexContains
	typeRegexArrayContains
	typeIP
)

// LabelFilter represents a condition based on a label name, value and matching operator. It
// applies to LogQL stream selectors and attribute filtering
type LabelFilter struct {
	key       string
	matcher   labelMatcher
	value     string
	valueType valueType
}

// LineFilter represents a condition based on a JSON raw text match.
type LineFilter struct {
	key        string
	strictKey  bool
	values     []lineMatch
	not        bool
	allowEmpty bool
	moreThan   bool
}

type lineMatch struct {
	value     string
	valueType valueType
}

func isRegex(v valueType) bool {
	return v == typeRegex || v == typeRegexContains || v == typeRegexArrayContains
}

func StringEqualLabelFilter(labelKey string, value string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelEqual,
		value:     value,
		valueType: typeString,
	}
}

func StringMatchLabelFilter(labelKey string, value string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelMatches,
		value:     value,
		valueType: typeString,
	}
}

func NotStringLabelFilter(labelKey string, value string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelNotEqual,
		value:     value,
		valueType: typeString,
	}
}

func MoreThanNumberLabelFilter(labelKey string, value string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelMoreThanOrEqual,
		value:     value,
		valueType: typeNumber,
	}
}

func StringNotMatchLabelFilter(labelKey string, value string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelNoMatches,
		value:     value,
		valueType: typeString,
	}
}

func IPLabelFilter(labelKey, cidr string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelEqual,
		value:     cidr,
		valueType: typeIP,
	}
}

func NotIPLabelFilter(labelKey, cidr string) LabelFilter {
	return LabelFilter{
		key:       labelKey,
		matcher:   labelNotEqual,
		value:     cidr,
		valueType: typeIP,
	}
}

func MultiValuesRegexFilter(labelKey string, values []string, not bool, equal bool) (LabelFilter, bool) {
	regexStr := strings.Builder{}
	for i, value := range values {
		if i > 0 {
			regexStr.WriteByte('|')
		}

		if !equal {
			// match the begining of string if quoted without a star
			// and case insensitive if no quotes
			if !strings.HasPrefix(value, `"`) {
				regexStr.WriteString("(?i).*")
			} else if !strings.HasPrefix(value, `"*`) {
				regexStr.WriteString("^")
			}
		}

		// inject value with regex
		regexStr.WriteString(valueReplacer.Replace(value))

		if !equal {
			// match the end of string if quoted without a star
			if !strings.HasSuffix(value, `"`) {
				regexStr.WriteString(".*")
			} else if !strings.HasSuffix(value, `*"`) {
				regexStr.WriteString("$")
			}
		}
	}

	if regexStr.Len() > 0 {
		if not {
			return StringNotMatchLabelFilter(labelKey, regexStr.String()), true
		}
		return StringMatchLabelFilter(labelKey, regexStr.String()), true
	}
	return LabelFilter{}, false
}

func (f *LabelFilter) WriteInto(sb *strings.Builder) {
	sb.WriteString(f.key)
	sb.WriteString(string(f.matcher))
	switch f.valueType {
	case typeNumber, typeBool, typeRegex:
		sb.WriteString(f.value)
	case typeString:
		sb.WriteByte('"')
		sb.WriteString(f.value)
		sb.WriteByte('"')
	case typeIP:
		sb.WriteString(`ip("`)
		sb.WriteString(f.value)
		sb.WriteString(`")`)
	case typeRegexContains:
		// match any case
		sb.WriteString("`(?i).*")
		sb.WriteString(f.value)
		sb.WriteString(".*`")
	case typeRegexArrayContains:
		// match any case and ensure we stay inside the array
		sb.WriteString("`(?i)[^]]*")
		sb.WriteString(f.value)
		sb.WriteString("[^]]*`")
	default:
		panic(fmt.Sprint("wrong filter value type", int(f.valueType)))
	}
}

// AsLabelFilters transforms a LineFilter (raw text match) into a group of
// labelFilters (attributes match)
func (f *LineFilter) AsLabelFilters() []LabelFilter {
	lfs := make([]LabelFilter, 0, len(f.values))
	for _, v := range f.values {
		lf := LabelFilter{
			key:       f.key,
			valueType: v.valueType,
			value:     v.value,
		}
		if isRegex(v.valueType) {
			lf.matcher = labelMatches
			if f.not {
				lf.matcher = labelNoMatches
			}
		} else {
			lf.matcher = labelEqual
			if f.not {
				lf.matcher = labelNotEqual
			} else if f.moreThan {
				lf.matcher = labelMoreThanOrEqual
			}
		}
		lfs = append(lfs, lf)
	}
	return lfs
}

func NewEmptyLineFilter(key string, not, moreThan, allowEmpty bool) LineFilter {
	return LineFilter{
		key:        key,
		not:        not,
		moreThan:   moreThan,
		allowEmpty: allowEmpty,
	}
}

func ExactMatchLineFilter(key string, value string) LineFilter {
	return LineFilter{
		key:       key,
		strictKey: true,
		values: []lineMatch{{
			valueType: typeString,
			value:     value,
		}},
	}
}

func RegexMatchLineFilter(key string, strictKey bool, value string) LineFilter {
	return LineFilter{
		key:       key,
		strictKey: strictKey,
		values: []lineMatch{{
			valueType: typeRegex,
			value:     value,
		}},
	}
}

func NotContainsKeyLineFilter(key string) LineFilter {
	return LineFilter{
		key:       key,
		strictKey: true,
		not:       true,
		moreThan:  false,
	}
}

// NumericLineFilter returns a LineFilter and true if it has an empty match
func NumericLineFilter(key string, values []string, not, moreThan bool) (LineFilter, bool) {
	return checkExact(
		LineFilter{
			key:      key,
			not:      not,
			moreThan: moreThan,
		},
		values,
		typeNumber)
}

// ArrayLineFilter returns a LineFilter and true if it has an empty match
func ArrayLineFilter(key string, values []string, not bool) (LineFilter, bool) {
	if len(values) == 1 && (values[0] == "" || values[0] == `""`) {
		// Special case, filter for n/a; note that logQL json doesn't support arrays, so we need a different solution
		if not {
			// key!=n/a
			return RegexMatchLineFilter(key, true, ".*"), false
		}
		// key=n/a
		return NotContainsKeyLineFilter(key), false
	}
	lf := LineFilter{key: key, not: not}
	for _, value := range values {
		lf.values = append(lf.values, lineMatch{valueType: typeRegexArrayContains, value: value})
	}
	return lf, false
}

// StringLineFilter returns a LineFilter and true if it has an empty match
func StringLineFilter(key string, values []string, not bool) (LineFilter, bool) {
	return checkExact(LineFilter{key: key, not: not}, values, typeString)
}

// StringLineFilterCheckExact returns a LineFilter and true if it has an empty match
func StringLineFilterCheckExact(key string, values []string, not bool) (LineFilter, bool) {
	return checkExact(LineFilter{key: key, not: not}, values, typeRegexContains)
}

func checkExact(lf LineFilter, values []string, defaultMatchType valueType) (LineFilter, bool) {
	hasEmptyMatch := false
	for _, value := range values {
		if isExactMatch(value) {
			trimmed := trimExactMatch(value)
			if trimmed == "" {
				hasEmptyMatch = true
			}
			lf.values = append(lf.values, lineMatch{valueType: typeString, value: trimmed})
		} else {
			lf.values = append(lf.values, lineMatch{valueType: defaultMatchType, value: value})
		}
	}
	return lf, hasEmptyMatch
}

func (f LineFilter) MatchTrue() LineFilter {
	f.values = []lineMatch{{valueType: typeBool, value: "true"}}
	return f
}

func (f LineFilter) MatchFalse() LineFilter {
	f.values = []lineMatch{{valueType: typeBool, value: "false"}}
	return f
}

func moreThanRegex(sb *strings.Builder, value string) {
	// match each number greater than specified value using regex
	// example for 123:
	// ( 12[3-9] | 1[3-9][0-9]+ | [2-9][0-9]+ | [1-9][0-9]{3,} )
	//       |            |              |             |
	//       |            |              |              ↪ match number more than 1000
	//       |            |              |
	//       |            |               ↪ match number from 200 to 999
	//       |            |
	//       |             ↪ match numbers from 130 to 199
	//       |
	//        ↪ match any number from 123 to 129

	sb.WriteString("(")
	for i, r := range value {
		if i < len(value)-1 {
			sb.WriteRune(r)
		} else {
			sb.WriteRune('[')
			sb.WriteRune(r)
			sb.WriteString("-9]")
		}
	}

	intVal, _ := strconv.Atoi(value)
	for i := 1; i < len(value); i++ {
		nextMin := int((intVal / int(math.Pow10(i))) + 1)
		nextMinStr := strconv.Itoa(nextMin)

		sb.WriteRune('|')
		if nextMin >= 10 {
			sb.WriteString(nextMinStr[0 : len(nextMinStr)-1])
		} else if i < len(value)-1 {
			sb.WriteString(value[0 : len(value)-1-i])
		}

		nextMinRune := nextMinStr[len(nextMinStr)-1:]
		if nextMin%9 != 0 {
			sb.WriteRune('[')
			sb.WriteString(nextMinRune)
			sb.WriteString("-9]")
		} else {
			sb.WriteString(nextMinRune)
		}

		sb.WriteString("[0-9]")

		if i > 1 {
			sb.WriteString("{")
			fmt.Fprintf(sb, "%d", i)
			sb.WriteString(",}")
		}
	}

	sb.WriteString("|[1-9][0-9]{")
	fmt.Fprintf(sb, "%d", len(value))
	sb.WriteString(",})")
}

// WriteInto transforms a LineFilter to its corresponding part of a LogQL query
// under construction (contained in the provided strings.Builder)
func (f *LineFilter) WriteInto(sb *strings.Builder) {
	if f.not {
		f.writeIntoNot(sb)
		return
	}

	sb.WriteString("|~`")
	if len(f.values) == 0 {
		// match only the end of KEY if not 'strictKey'
		// no value will be provided here as we only check if key exists
		if f.strictKey {
			sb.WriteByte('"')
		}
		sb.WriteString(f.key)
		sb.WriteString(`"`)
	} else {
		for i, v := range f.values {
			if i > 0 {
				sb.WriteByte('|')
			}
			f.writeValueInto(sb, v)
		}
	}
	sb.WriteRune('`')
}

// WriteInto transforms a LineFilter to its corresponding part of a LogQL query
// under construction (contained in the provided strings.Builder)
func (f *LineFilter) writeIntoNot(sb *strings.Builder) {
	if !f.allowEmpty {
		// the record must contains the field if values are specified
		// since FLP skip empty fields / zeros values
		if len(f.values) > 0 {
			sb.WriteString("|~`\"")
			sb.WriteString(f.key)
			sb.WriteString("\"`")
		}
	}

	if len(f.values) == 0 {
		// then we exclude match results
		sb.WriteString("!~`")

		// match only the end of KEY if not 'strictKey'
		// no value will be provided here as we only check if key exists
		if f.strictKey {
			sb.WriteByte('"')
		}
		sb.WriteString(f.key)
		sb.WriteString("\"`")
	} else {
		for _, v := range f.values {
			sb.WriteString("!~`")
			f.writeValueInto(sb, v)
			sb.WriteRune('`')
		}
	}
}

func (f *LineFilter) writeValueInto(sb *strings.Builder, v lineMatch) {
	// match only the end of KEY + regex VALUE if not 'strictKey'
	// if numeric, KEY":VALUE,
	// if string KEY":"VALUE"
	// ie 'Port' key will match both 'SrcPort":"XXX"' and 'DstPort":"XXX"
	// VALUE can be quoted for exact match or contains * to inject regex any
	// For numeric values, exact match is implicit
	// 	(the trick is to match for the ending coma; it works as long as the filtered field
	// 	is not the last one (they're in alphabetic order); a less performant alternative
	// 	but more future-proof/less hacky could be to move that to a json filter, if needed)
	if f.strictKey {
		sb.WriteByte('"')
	}
	sb.WriteString(f.key)
	sb.WriteString(`":`)
	switch v.valueType {
	case typeNumber, typeRegex:
		if f.moreThan {
			moreThanRegex(sb, v.value)
		} else {
			sb.WriteString(v.value)
		}
		// a number or regex can be followed by } if it's the last property of a JSON document
		sb.WriteString("[,}]")
	case typeBool:
		sb.WriteString(v.value)
	case typeString, typeIP:
		// exact matches are specified as just strings
		sb.WriteByte('"')
		sb.WriteString(valueReplacer.Replace(v.value))
		sb.WriteByte('"')
	// contains-match are specified as regular expressions
	case typeRegexContains:
		sb.WriteString(`"(?i)[^"]*`)
		sb.WriteString(valueReplacer.Replace(v.value))
		sb.WriteString(`.*"`)
	// for array, we ensure it starts by [ and ends by ]
	case typeRegexArrayContains:
		sb.WriteString(`\[(?i)[^]]*`)
		sb.WriteString(valueReplacer.Replace(v.value))
		sb.WriteString(`[^]]*]`)
	}
}
